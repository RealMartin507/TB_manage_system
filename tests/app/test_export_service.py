"""
导出逻辑单元测试 - Phase 5
覆盖：
1. 单任务导出：验证行数、列顺序、序号保留原始值
2. 多任务导出：同一图斑关联 2 个任务 → 导出为 2 行
3. 空值处理：空字段导出为空字符串而非 None
4. 字段过滤：只导出 fields 参数指定的列
"""
from __future__ import annotations

import sqlite3

import openpyxl
import pytest

from app.services.export_service import execute_export, get_export_file, delete_export_file

# ──────────────────────────────────────────────
# 内存数据库 Schema（与 test_import_service 保持一致）
# ──────────────────────────────────────────────

_SCHEMA = """
CREATE TABLE IF NOT EXISTS tb_plot (
    plot_id        TEXT PRIMARY KEY,
    township       TEXT,
    village        TEXT,
    area           REAL,
    farmland_area  REAL,
    basic_farmland REAL,
    plot_type      TEXT,
    land_before    TEXT,
    land_after     TEXT,
    folder_path    TEXT,
    created_at     DATETIME DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS tb_platform (
    platform_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    platform_name TEXT NOT NULL,
    platform_url  TEXT,
    sort_order    INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tb_task (
    task_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    task_name    TEXT NOT NULL,
    source       TEXT,
    platform_id  INTEGER REFERENCES tb_platform(platform_id) ON DELETE SET NULL,
    created_time DATE,
    deadline     DATE,
    import_time  DATETIME DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS tb_plot_task (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    plot_id           TEXT    NOT NULL REFERENCES tb_plot(plot_id) ON DELETE CASCADE,
    task_id           INTEGER NOT NULL REFERENCES tb_task(task_id) ON DELETE CASCADE,
    seq_no            INTEGER,
    project_name      TEXT,
    land_unit         TEXT,
    approval_doc      TEXT,
    land_supply_doc   TEXT,
    legality          TEXT,
    internal_review   TEXT,
    field_survey      TEXT,
    report_status     TEXT DEFAULT '待报',
    reject_reason     TEXT,
    archive_status    TEXT,
    dispatch          TEXT,
    overlap_situation TEXT,
    overlap_ratio     REAL,
    overlap_area      REAL,
    remark            TEXT
);
"""


@pytest.fixture
def db():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(_SCHEMA)
    conn.commit()
    yield conn
    conn.close()


# ── 辅助函数 ──────────────────────────────────────

def _insert_plot(conn: sqlite3.Connection, plot_id: str, **kwargs) -> None:
    data = {"plot_id": plot_id, **kwargs}
    cols = ", ".join(data)
    ph = ", ".join("?" * len(data))
    conn.execute(f"INSERT INTO tb_plot ({cols}) VALUES ({ph})", list(data.values()))
    conn.commit()


def _insert_task(conn: sqlite3.Connection, task_name: str, source: str = "测试来源") -> int:
    cur = conn.execute(
        "INSERT INTO tb_task (task_name, source, created_time, deadline) VALUES (?, ?, ?, ?)",
        (task_name, source, "2026-01-01", "2026-06-30"),
    )
    conn.commit()
    return cur.lastrowid  # type: ignore[return-value]


def _insert_plot_task(conn: sqlite3.Connection, plot_id: str, task_id: int, **kwargs) -> None:
    data = {"plot_id": plot_id, "task_id": task_id, **kwargs}
    cols = ", ".join(data)
    ph = ", ".join("?" * len(data))
    conn.execute(f"INSERT INTO tb_plot_task ({cols}) VALUES ({ph})", list(data.values()))
    conn.commit()


def _read_xlsx(token: str) -> list[list[str]]:
    """读取导出的 xlsx，返回所有行（含表头），每格转为字符串。"""
    path = get_export_file(token)
    wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
    ws = wb.active
    rows = []
    for row in ws.iter_rows(values_only=True):
        rows.append([str(c) if c is not None else "" for c in row])
    wb.close()
    return rows


# ── 测试用例 ──────────────────────────────────────

class TestSingleTaskExport:
    """单任务导出：行数、列顺序、序号保留原始值"""

    def test_row_count(self, db):
        task_id = _insert_task(db, "任务A")
        _insert_plot(db, "P001", township="镇A")
        _insert_plot(db, "P002", township="镇B")
        _insert_plot_task(db, "P001", task_id, seq_no=5)
        _insert_plot_task(db, "P002", task_id, seq_no=10)

        result = execute_export(db, [task_id], ["seq_no", "plot_id", "township"])
        rows = _read_xlsx(result["download_token"])
        delete_export_file(result["download_token"])

        assert result["row_count"] == 2
        # 表头 + 2 数据行
        assert len(rows) == 3

    def test_column_order(self, db):
        """列顺序严格按 fields 参数传入顺序。"""
        task_id = _insert_task(db, "任务B")
        _insert_plot(db, "P003", township="镇C", village="村C")
        _insert_plot_task(db, "P003", task_id, seq_no=1)

        fields = ["village", "township", "seq_no"]
        result = execute_export(db, [task_id], fields)
        rows = _read_xlsx(result["download_token"])
        delete_export_file(result["download_token"])

        header = rows[0]
        assert header == ["村名称", "乡镇名称", "序号"]

    def test_seq_no_preserved(self, db):
        """序号保留原始导入值，不重新排列。"""
        task_id = _insert_task(db, "任务C")
        _insert_plot(db, "P004")
        _insert_plot(db, "P005")
        _insert_plot_task(db, "P004", task_id, seq_no=42)
        _insert_plot_task(db, "P005", task_id, seq_no=7)

        result = execute_export(db, [task_id], ["seq_no", "plot_id"])
        rows = _read_xlsx(result["download_token"])
        delete_export_file(result["download_token"])

        seq_values = {rows[1][1]: rows[1][0], rows[2][1]: rows[2][0]}
        assert seq_values["P004"] == "42"
        assert seq_values["P005"] == "7"


class TestMultiTaskExport:
    """多任务导出：同一图斑关联 2 个任务 → 导出为 2 行"""

    def test_same_plot_two_tasks(self, db):
        task_id1 = _insert_task(db, "任务D", source="来源D")
        task_id2 = _insert_task(db, "任务E", source="来源E")
        _insert_plot(db, "P006")
        _insert_plot_task(db, "P006", task_id1, seq_no=1, report_status="已报")
        _insert_plot_task(db, "P006", task_id2, seq_no=2, report_status="待报")

        result = execute_export(db, [task_id1, task_id2], ["plot_id", "source", "report_status"])
        rows = _read_xlsx(result["download_token"])
        delete_export_file(result["download_token"])

        assert result["row_count"] == 2
        # 两行数据，plot_id 均为 P006，但来源和状态不同
        data_rows = rows[1:]
        assert all(r[0] == "P006" for r in data_rows)
        sources = {r[1] for r in data_rows}
        assert sources == {"来源D", "来源E"}


class TestNullValueHandling:
    """空值字段导出为空字符串而非 None"""

    def test_null_fields_become_empty_string(self, db):
        task_id = _insert_task(db, "任务F")
        _insert_plot(db, "P007", township=None)
        _insert_plot_task(db, "P007", task_id, seq_no=1, remark=None, project_name=None)

        result = execute_export(db, [task_id], ["township", "remark", "project_name"])
        rows = _read_xlsx(result["download_token"])
        delete_export_file(result["download_token"])

        data_row = rows[1]
        for cell in data_row:
            assert cell != "None", f"空值不应导出为字符串 'None'，实际为：{cell!r}"
            assert cell == ""


class TestFieldFilter:
    """只导出 fields 参数指定的列"""

    def test_only_specified_fields_exported(self, db):
        task_id = _insert_task(db, "任务G")
        _insert_plot(db, "P008", township="镇G", village="村G")
        _insert_plot_task(db, "P008", task_id, seq_no=3, remark="备注G")

        # 只选 plot_id 和 remark，不含 township
        result = execute_export(db, [task_id], ["plot_id", "remark"])
        rows = _read_xlsx(result["download_token"])
        delete_export_file(result["download_token"])

        header = rows[0]
        assert len(header) == 2
        assert "监测编号" in header
        assert "备注" in header
        assert "乡镇名称" not in header

    def test_empty_task_ids_returns_zero_rows(self, db):
        result = execute_export(db, [], ["plot_id"])
        rows = _read_xlsx(result["download_token"])
        delete_export_file(result["download_token"])

        assert result["row_count"] == 0
        # 只有表头行
        assert len(rows) == 1
