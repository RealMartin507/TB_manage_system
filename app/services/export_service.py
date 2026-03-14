"""
导出逻辑服务层 - Phase 5 实现
"""
from __future__ import annotations

import sqlite3
import tempfile
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any

import openpyxl

# ──────────────────────────────────────────────
# 字段元信息：顺序与 fieldMap.ts 严格一致
# ──────────────────────────────────────────────

# 各字段来源表（决定查询时取哪张表的列）
# plot   → tb_plot
# task   → tb_task
# pt     → tb_plot_task
_FIELD_SOURCE: dict[str, str] = {
    "seq_no":            "pt",
    "plot_id":           "plot",
    "source":            "task",
    "township":          "plot",
    "village":           "plot",
    "area":              "plot",
    "farmland_area":     "plot",
    "basic_farmland":    "plot",
    "plot_type":         "plot",
    "land_before":       "plot",
    "land_after":        "plot",
    "project_name":      "pt",
    "land_unit":         "pt",
    "approval_doc":      "pt",
    "land_supply_doc":   "pt",
    "legality":          "pt",
    "internal_review":   "pt",
    "field_survey":      "pt",
    "report_status":     "pt",
    "reject_reason":     "pt",
    "created_time":      "task",
    "deadline":          "task",
    "archive_status":    "pt",
    "dispatch":          "pt",
    "overlap_situation": "pt",
    "overlap_ratio":     "pt",
    "overlap_area":      "pt",
    "remark":            "pt",
}

_FIELD_LABEL: dict[str, str] = {
    "seq_no":            "序号",
    "plot_id":           "监测编号",
    "source":            "任务来源",
    "township":          "乡镇名称",
    "village":           "村名称",
    "area":              "监测面积",
    "farmland_area":     "耕地面积",
    "basic_farmland":    "占基本农田面积",
    "plot_type":         "图斑类型",
    "land_before":       "变化前地类",
    "land_after":        "变化后地类",
    "project_name":      "项目名称",
    "land_unit":         "用地单位",
    "approval_doc":      "批单",
    "land_supply_doc":   "供地资料",
    "legality":          "合法性判定",
    "internal_review":   "内审",
    "field_survey":      "外业组调查说明",
    "report_status":     "填报",
    "reject_reason":     "退回原因",
    "created_time":      "任务建立时间",
    "deadline":          "任务截止时间",
    "archive_status":    "存档",
    "dispatch":          "调度",
    "overlap_situation": "批单套合情况",
    "overlap_ratio":     "批单套合比例",
    "overlap_area":      "套合面积",
    "remark":            "备注",
}

# 临时文件目录
_TEMP_DIR = Path(tempfile.gettempdir()) / "tb_manager_exports"
_TEMP_DIR.mkdir(parents=True, exist_ok=True)

# download_token -> 文件路径映射（进程内缓存）
_export_files: dict[str, Path] = {}


# ──────────────────────────────────────────────
# 公开接口
# ──────────────────────────────────────────────

def execute_export(
    db: sqlite3.Connection,
    task_ids: list[int],
    fields: list[str],
) -> dict[str, Any]:
    """
    执行导出。
    - 按 task_ids 查询所有关联图斑-任务记录
    - 同一图斑关联多个所选任务 → 每个任务关联导出为独立一行
    - 列顺序严格按 fields 参数传入顺序
    - 返回 { download_token, filename, row_count }
    """
    rows = _query_rows(db, task_ids)
    wb = _build_workbook(rows, fields)

    # 生成文件名
    today_str = datetime.now().strftime("%Y%m%d")
    sources = _get_task_sources(db, task_ids)
    if len(sources) == 1:
        filename = f"{sources[0]}_{today_str}.xlsx"
    else:
        filename = f"多任务导出_{today_str}.xlsx"

    # 保存到 temp
    token = str(uuid.uuid4()).replace("-", "")
    dest = _TEMP_DIR / f"{token}.xlsx"
    wb.save(str(dest))
    _export_files[token] = dest

    return {
        "download_token": token,
        "filename": filename,
        "row_count": len(rows),
    }


def get_export_file(token: str) -> Path:
    """根据 token 返回文件路径，文件不存在则抛 ValueError。"""
    path = _export_files.get(token)
    if path is None or not path.exists():
        raise ValueError(f"download_token 无效或文件已过期：{token}")
    return path


def delete_export_file(token: str) -> None:
    """下载完成后删除 temp 文件并清理缓存。"""
    path = _export_files.pop(token, None)
    if path and path.exists():
        path.unlink(missing_ok=True)


# ──────────────────────────────────────────────
# 内部实现
# ──────────────────────────────────────────────

def _query_rows(db: sqlite3.Connection, task_ids: list[int]) -> list[dict[str, Any]]:
    """
    查询所有选中任务下的图斑-任务关联行，返回扁平化字典列表。
    每条 (plot_id, task_id) 组合为独立一行。
    """
    if not task_ids:
        return []

    placeholders = ",".join("?" * len(task_ids))
    sql = f"""
        SELECT
            pt.seq_no,
            p.plot_id,
            t.source,
            p.township,
            p.village,
            p.area,
            p.farmland_area,
            p.basic_farmland,
            p.plot_type,
            p.land_before,
            p.land_after,
            pt.project_name,
            pt.land_unit,
            pt.approval_doc,
            pt.land_supply_doc,
            pt.legality,
            pt.internal_review,
            pt.field_survey,
            pt.report_status,
            pt.reject_reason,
            t.created_time,
            t.deadline,
            pt.archive_status,
            pt.dispatch,
            pt.overlap_situation,
            pt.overlap_ratio,
            pt.overlap_area,
            pt.remark
        FROM tb_plot_task pt
        JOIN tb_plot p ON p.plot_id = pt.plot_id
        JOIN tb_task t ON t.task_id = pt.task_id
        WHERE pt.task_id IN ({placeholders})
        ORDER BY pt.task_id, pt.seq_no
    """
    rows = db.execute(sql, task_ids).fetchall()
    return [dict(r) for r in rows]


def _get_task_sources(db: sqlite3.Connection, task_ids: list[int]) -> list[str]:
    """返回所选任务的唯一来源列表（去重，保序）。"""
    if not task_ids:
        return []
    placeholders = ",".join("?" * len(task_ids))
    rows = db.execute(
        f"SELECT DISTINCT source FROM tb_task WHERE task_id IN ({placeholders}) AND source IS NOT NULL",
        task_ids,
    ).fetchall()
    return [r["source"] for r in rows]


def _cell_value(raw: Any) -> str:
    """将字段原始值转换为单元格字符串；None → 空字符串。"""
    if raw is None:
        return ""
    if isinstance(raw, (date, datetime)):
        return str(raw)
    return str(raw)


def _build_workbook(
    rows: list[dict[str, Any]],
    fields: list[str],
) -> openpyxl.Workbook:
    """按 fields 顺序构建 openpyxl Workbook。"""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "导出数据"

    # 表头行（使用中文 label）
    headers = [_FIELD_LABEL.get(f, f) for f in fields]
    ws.append(headers)

    # 数据行
    for row in rows:
        cell_row = [_cell_value(row.get(f)) for f in fields]
        ws.append(cell_row)

    return wb
