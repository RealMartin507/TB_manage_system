"""
导入逻辑服务层 - Phase 3 实现
"""
from __future__ import annotations

import json
import sqlite3
import tempfile
import uuid
from pathlib import Path
from typing import Any

import openpyxl

# 临时文件存储目录（session 级别）
_TEMP_DIR = Path(tempfile.gettempdir()) / "tb_manager_imports"
_TEMP_DIR.mkdir(parents=True, exist_ok=True)

# session_id -> 文件路径映射（内存缓存，进程级别）
_session_files: dict[str, Path] = {}


# ──────────────────────────────────────────────
# 文件上传 / 解析
# ──────────────────────────────────────────────

def save_upload(file_bytes: bytes, filename: str) -> dict[str, Any]:
    """
    保存上传文件并解析所有 Sheet 信息。
    返回：{ session_id, filename, file_size, sheets: [{name, row_count}] }
    """
    session_id = str(uuid.uuid4())
    suffix = Path(filename).suffix or ".xlsx"
    dest = _TEMP_DIR / f"{session_id}{suffix}"
    dest.write_bytes(file_bytes)
    _session_files[session_id] = dest

    wb = openpyxl.load_workbook(dest, read_only=True, data_only=True)
    sheets = []
    for name in wb.sheetnames:
        ws = wb[name]
        row_count = ws.max_row or 0
        sheets.append({"name": name, "row_count": row_count})
    wb.close()

    return {
        "session_id": session_id,
        "filename": filename,
        "file_size": len(file_bytes),
        "sheets": sheets,
    }


def get_session_path(session_id: str) -> Path:
    """获取 session 对应的文件路径，不存在则抛出 ValueError。"""
    path = _session_files.get(session_id)
    if path is None or not path.exists():
        raise ValueError(f"session_id 无效或文件已过期：{session_id}")
    return path


# ──────────────────────────────────────────────
# 预览
# ──────────────────────────────────────────────

def preview_sheet(
    session_id: str,
    sheet_name: str,
    header_row: int,
    preview_count: int = 20,
) -> dict[str, Any]:
    """
    读取指定 Sheet 的表头行和前 N 行数据。
    header_row: 1-based 行号，默认第1行为表头
    返回：{ headers, preview_rows, total_rows }
    """
    path = get_session_path(session_id)
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    if sheet_name not in wb.sheetnames:
        raise ValueError(f"Sheet 不存在：{sheet_name}")
    ws = wb[sheet_name]

    all_rows = list(ws.iter_rows(values_only=True))
    wb.close()

    if not all_rows or header_row < 1 or header_row > len(all_rows):
        return {"headers": [], "preview_rows": [], "total_rows": 0}

    header_idx = header_row - 1  # 0-based
    raw_headers = all_rows[header_idx]
    headers = [str(h) if h is not None else "" for h in raw_headers]

    data_rows = all_rows[header_row:]  # header_row 即 0-based 的数据起始索引
    total_rows = len(data_rows)
    preview_rows = [
        [str(cell) if cell is not None else "" for cell in row]
        for row in data_rows[:preview_count]
    ]

    return {
        "headers": headers,
        "preview_rows": preview_rows,
        "total_rows": total_rows,
    }


# ──────────────────────────────────────────────
# 导入执行
# ──────────────────────────────────────────────

# tb_plot 包含的字段（不含 created_at）
_PLOT_FIELDS = {
    "plot_id", "township", "village", "area", "farmland_area", "basic_farmland",
    "plot_type", "land_before", "land_after", "folder_path",
}

# tb_plot_task 包含的字段（不含 id, plot_id, task_id）
_PLOT_TASK_FIELDS = {
    "seq_no", "project_name", "land_unit", "approval_doc", "land_supply_doc",
    "legality", "internal_review", "field_survey", "report_status",
    "reject_reason", "archive_status", "dispatch",
    "overlap_situation", "overlap_ratio", "overlap_area", "remark",
}

IGNORE_VALUE = "__ignore__"

_VALID_REPORT_STATUSES = {"已报", "待报", "退回", "待定", "未处理"}


def execute_import(
    db: sqlite3.Connection,
    *,
    session_id: str,
    sheet_name: str,
    header_row: int,
    data_start_row: int,
    data_end_row: int,
    source: str,
    task_name: str,
    platform_id: int | None,
    mapping: dict[str, str],
) -> dict[str, int]:
    """
    执行批量导入。
    mapping 格式：{ system_field: excel_column_header }
    excel_column_header 为 "__ignore__" 时跳过该字段。
    返回：{ added, updated, skipped }
    """
    path = get_session_path(session_id)
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    if sheet_name not in wb.sheetnames:
        raise ValueError(f"Sheet 不存在：{sheet_name}")
    ws = wb[sheet_name]
    all_rows = list(ws.iter_rows(values_only=True))
    wb.close()

    if not all_rows:
        return {"added": 0, "updated": 0, "skipped": 0}

    header_idx = header_row - 1
    headers = [str(h) if h is not None else "" for h in all_rows[header_idx]]

    # 建立 excel 列名 -> 列索引映射
    col_index: dict[str, int] = {name: i for i, name in enumerate(headers)}

    # 确定数据行范围（1-based，包含两端）
    start_idx = data_start_row - 1  # 0-based
    end_idx = data_end_row          # 0-based exclusive
    data_rows = all_rows[start_idx:end_idx]

    # 获取或创建任务
    task_id = _get_or_create_task(db, task_name=task_name, source=source, platform_id=platform_id)

    added = 0
    updated = 0
    skipped = 0

    for raw_row in data_rows:
        row = [str(cell) if cell is not None else None for cell in raw_row]

        # 按 mapping 提取字段值
        record: dict[str, Any] = {}
        for sys_field, excel_col in mapping.items():
            if excel_col == IGNORE_VALUE or excel_col == "":
                continue
            idx = col_index.get(excel_col)
            if idx is None or idx >= len(row):
                record[sys_field] = None
            else:
                val = row[idx]
                record[sys_field] = _coerce_value(sys_field, val)

        # report_status 兜底：非合法值（含空）统一存为「未处理」
        if record.get("report_status") not in _VALID_REPORT_STATUSES:
            record["report_status"] = "未处理"

        plot_id = record.get("plot_id")
        if not plot_id:
            skipped += 1
            continue

        # 检查图斑是否存在
        existing = db.execute(
            "SELECT plot_id FROM tb_plot WHERE plot_id = ?", (plot_id,)
        ).fetchone()

        if existing is None:
            # 新增图斑
            plot_data = {k: v for k, v in record.items() if k in _PLOT_FIELDS}
            plot_data["plot_id"] = plot_id
            _insert_plot(db, plot_data)
            added += 1
        else:
            updated += 1

        # 追加 plot_task（不重复检查，允许同一图斑同一任务多次关联时跳过）
        pt_exists = db.execute(
            "SELECT id FROM tb_plot_task WHERE plot_id = ? AND task_id = ?",
            (plot_id, task_id),
        ).fetchone()

        if pt_exists is None:
            pt_data = {k: v for k, v in record.items() if k in _PLOT_TASK_FIELDS}
            pt_data["plot_id"] = plot_id
            pt_data["task_id"] = task_id
            _insert_plot_task(db, pt_data)

    db.commit()
    return {"added": added, "updated": updated, "skipped": skipped}


def _get_or_create_task(
    db: sqlite3.Connection,
    *,
    task_name: str,
    source: str,
    platform_id: int | None,
) -> int:
    """按 task_name + source + platform_id 查找或新建任务，返回 task_id。"""
    if platform_id:
        row = db.execute(
            "SELECT task_id FROM tb_task WHERE task_name = ? AND source = ? AND platform_id = ?",
            (task_name, source, platform_id),
        ).fetchone()
    else:
        row = db.execute(
            "SELECT task_id FROM tb_task WHERE task_name = ? AND source = ? AND platform_id IS NULL",
            (task_name, source),
        ).fetchone()

    if row:
        return row["task_id"]

    cur = db.execute(
        "INSERT INTO tb_task (task_name, source, platform_id) VALUES (?, ?, ?)",
        (task_name, source, platform_id),
    )
    return cur.lastrowid  # type: ignore[return-value]


def _insert_plot(db: sqlite3.Connection, data: dict[str, Any]) -> None:
    cols = ", ".join(data.keys())
    placeholders = ", ".join("?" * len(data))
    db.execute(
        f"INSERT OR IGNORE INTO tb_plot ({cols}) VALUES ({placeholders})",
        list(data.values()),
    )


def _insert_plot_task(db: sqlite3.Connection, data: dict[str, Any]) -> None:
    cols = ", ".join(data.keys())
    placeholders = ", ".join("?" * len(data))
    db.execute(
        f"INSERT INTO tb_plot_task ({cols}) VALUES ({placeholders})",
        list(data.values()),
    )


def _coerce_value(field: str, value: str | None) -> Any:
    """将字符串值转换为字段对应的 Python 类型。"""
    if value is None or value.strip() == "":
        return None
    v = value.strip()
    if field in ("area", "farmland_area", "basic_farmland", "overlap_ratio", "overlap_area"):
        try:
            return float(v)
        except ValueError:
            return None
    if field == "seq_no":
        try:
            return int(float(v))
        except ValueError:
            return None
    return v


# ──────────────────────────────────────────────
# 兼容旧接口（Phase 1 占位，保留函数签名）
# ──────────────────────────────────────────────

def parse_excel(file_path: str, mapping: dict) -> list[dict]:
    """解析 Excel 文件并根据 mapping 转换为图斑记录列表。"""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"文件不存在：{file_path}")

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    all_rows = list(ws.iter_rows(values_only=True))  # type: ignore[union-attr]
    wb.close()

    if not all_rows:
        return []

    headers = [str(h) if h is not None else "" for h in all_rows[0]]
    col_index: dict[str, int] = {name: i for i, name in enumerate(headers)}

    records = []
    for raw_row in all_rows[1:]:
        row = [str(cell) if cell is not None else None for cell in raw_row]
        record: dict[str, Any] = {}
        for sys_field, excel_col in mapping.items():
            if excel_col == IGNORE_VALUE or excel_col == "":
                continue
            idx = col_index.get(excel_col)
            record[sys_field] = _coerce_value(sys_field, row[idx] if idx is not None and idx < len(row) else None)
        records.append(record)
    return records


def import_plot_task_batch(db_conn: sqlite3.Connection, records: list[dict], task_id: int) -> dict:
    """批量导入图斑-任务关联记录。"""
    added = 0
    updated = 0
    skipped = 0

    for record in records:
        plot_id = record.get("plot_id")
        if not plot_id:
            skipped += 1
            continue

        if record.get("report_status") not in _VALID_REPORT_STATUSES:
            record["report_status"] = "未处理"

        existing = db_conn.execute(
            "SELECT plot_id FROM tb_plot WHERE plot_id = ?", (plot_id,)
        ).fetchone()

        if existing is None:
            plot_data = {k: v for k, v in record.items() if k in _PLOT_FIELDS}
            plot_data["plot_id"] = plot_id
            _insert_plot(db_conn, plot_data)
            added += 1
        else:
            updated += 1

        pt_exists = db_conn.execute(
            "SELECT id FROM tb_plot_task WHERE plot_id = ? AND task_id = ?",
            (plot_id, task_id),
        ).fetchone()
        if pt_exists is None:
            pt_data = {k: v for k, v in record.items() if k in _PLOT_TASK_FIELDS}
            pt_data["plot_id"] = plot_id
            pt_data["task_id"] = task_id
            _insert_plot_task(db_conn, pt_data)

    db_conn.commit()
    return {"added": added, "updated": updated, "skipped": skipped}
