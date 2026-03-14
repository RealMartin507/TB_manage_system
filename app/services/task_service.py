"""任务表 CRUD 服务层"""
import sqlite3
from typing import Any, Optional

from app.schemas import TaskCreate, TaskUpdate


def get_tasks(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM tb_task ORDER BY task_id DESC"
    ).fetchall()
    return [dict(r) for r in rows]


def get_task(conn: sqlite3.Connection, task_id: int) -> Optional[dict[str, Any]]:
    row = conn.execute(
        "SELECT * FROM tb_task WHERE task_id = ?", (task_id,)
    ).fetchone()
    return dict(row) if row else None


def create_task(conn: sqlite3.Connection, data: TaskCreate) -> dict[str, Any]:
    d = data.model_dump()
    cols = ", ".join(d.keys())
    placeholders = ", ".join("?" * len(d))
    cur = conn.execute(
        f"INSERT INTO tb_task ({cols}) VALUES ({placeholders})", list(d.values())
    )
    conn.commit()
    return get_task(conn, cur.lastrowid)  # type: ignore[return-value]


def update_task(
    conn: sqlite3.Connection, task_id: int, data: TaskUpdate
) -> Optional[dict[str, Any]]:
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        return get_task(conn, task_id)
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    conn.execute(
        f"UPDATE tb_task SET {set_clause} WHERE task_id = ?",
        list(updates.values()) + [task_id],
    )
    conn.commit()
    return get_task(conn, task_id)


def delete_task(conn: sqlite3.Connection, task_id: int) -> bool:
    # tb_plot_task 通过外键 ON DELETE CASCADE 自动清除
    cur = conn.execute("DELETE FROM tb_task WHERE task_id = ?", (task_id,))
    conn.commit()
    return cur.rowcount > 0
