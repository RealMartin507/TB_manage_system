"""填报平台配置 CRUD 服务层"""
import sqlite3
from typing import Any, Optional

from app.schemas import PlatformCreate, PlatformUpdate


def get_platforms(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM tb_platform ORDER BY sort_order, platform_id"
    ).fetchall()
    return [dict(r) for r in rows]


def get_platform(
    conn: sqlite3.Connection, platform_id: int
) -> Optional[dict[str, Any]]:
    row = conn.execute(
        "SELECT * FROM tb_platform WHERE platform_id = ?", (platform_id,)
    ).fetchone()
    return dict(row) if row else None


def create_platform(
    conn: sqlite3.Connection, data: PlatformCreate
) -> dict[str, Any]:
    d = data.model_dump()
    cols = ", ".join(d.keys())
    placeholders = ", ".join("?" * len(d))
    cur = conn.execute(
        f"INSERT INTO tb_platform ({cols}) VALUES ({placeholders})",
        list(d.values()),
    )
    conn.commit()
    return get_platform(conn, cur.lastrowid)  # type: ignore[return-value]


def update_platform(
    conn: sqlite3.Connection, platform_id: int, data: PlatformUpdate
) -> Optional[dict[str, Any]]:
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        return get_platform(conn, platform_id)
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    conn.execute(
        f"UPDATE tb_platform SET {set_clause} WHERE platform_id = ?",
        list(updates.values()) + [platform_id],
    )
    conn.commit()
    return get_platform(conn, platform_id)


def delete_platform(conn: sqlite3.Connection, platform_id: int) -> bool:
    cur = conn.execute(
        "DELETE FROM tb_platform WHERE platform_id = ?", (platform_id,)
    )
    conn.commit()
    return cur.rowcount > 0
