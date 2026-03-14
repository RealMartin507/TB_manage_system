"""图斑-任务关联表 CRUD 服务层"""
import sqlite3
from typing import Any, Optional

from app.schemas import PlotTaskCreate, PlotTaskUpdate, PlotTaskDetailOut


def get_plot_tasks(
    conn: sqlite3.Connection,
    *,
    plot_id: Optional[str] = None,
    task_id: Optional[int] = None,
) -> list[dict[str, Any]]:
    conditions: list[str] = []
    params: list[Any] = []

    if plot_id:
        conditions.append("plot_id = ?")
        params.append(plot_id)
    if task_id is not None:
        conditions.append("task_id = ?")
        params.append(task_id)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    rows = conn.execute(
        f"SELECT * FROM tb_plot_task {where} ORDER BY seq_no", params
    ).fetchall()
    return [dict(r) for r in rows]


def get_plot_task(
    conn: sqlite3.Connection, record_id: int
) -> Optional[dict[str, Any]]:
    row = conn.execute(
        "SELECT * FROM tb_plot_task WHERE id = ?", (record_id,)
    ).fetchone()
    return dict(row) if row else None


def get_plot_task_full(
    conn: sqlite3.Connection, record_id: int
) -> Optional[PlotTaskDetailOut]:
    """获取单条关联记录，含任务层和平台层完整字段"""
    row = conn.execute(
        """
        SELECT pt.*,
               t.source, t.created_time, t.deadline,
               t.platform_id,
               pl.platform_name, pl.platform_url
        FROM tb_plot_task pt
        JOIN tb_task t ON t.task_id = pt.task_id
        LEFT JOIN tb_platform pl ON pl.platform_id = t.platform_id
        WHERE pt.id = ?
        """,
        (record_id,),
    ).fetchone()
    if row is None:
        return None
    return PlotTaskDetailOut(**dict(row))


def create_plot_task(
    conn: sqlite3.Connection, data: PlotTaskCreate
) -> dict[str, Any]:
    d = data.model_dump()
    cols = ", ".join(d.keys())
    placeholders = ", ".join("?" * len(d))
    cur = conn.execute(
        f"INSERT INTO tb_plot_task ({cols}) VALUES ({placeholders})",
        list(d.values()),
    )
    conn.commit()
    return get_plot_task(conn, cur.lastrowid)  # type: ignore[return-value]


def update_plot_task(
    conn: sqlite3.Connection, record_id: int, data: PlotTaskUpdate
) -> Optional[dict[str, Any]]:
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        return get_plot_task(conn, record_id)
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    conn.execute(
        f"UPDATE tb_plot_task SET {set_clause} WHERE id = ?",
        list(updates.values()) + [record_id],
    )
    conn.commit()
    return get_plot_task(conn, record_id)


def delete_plot_task(conn: sqlite3.Connection, record_id: int) -> bool:
    cur = conn.execute("DELETE FROM tb_plot_task WHERE id = ?", (record_id,))
    conn.commit()
    return cur.rowcount > 0
