"""导入/导出模板 CRUD 服务层"""
import sqlite3
from typing import Any, Optional

from app.schemas import (
    ImportTemplateCreate,
    ImportTemplateUpdate,
    ExportTemplateCreate,
    ExportTemplateUpdate,
)


# ──────────────────────────────────────────────
# 导入映射模板
# ──────────────────────────────────────────────

def get_import_templates(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM tb_import_template ORDER BY template_id DESC"
    ).fetchall()
    return [dict(r) for r in rows]


def get_import_template(
    conn: sqlite3.Connection, template_id: int
) -> Optional[dict[str, Any]]:
    row = conn.execute(
        "SELECT * FROM tb_import_template WHERE template_id = ?", (template_id,)
    ).fetchone()
    return dict(row) if row else None


def create_import_template(
    conn: sqlite3.Connection, data: ImportTemplateCreate
) -> dict[str, Any]:
    d = data.model_dump()
    cols = ", ".join(d.keys())
    placeholders = ", ".join("?" * len(d))
    cur = conn.execute(
        f"INSERT INTO tb_import_template ({cols}) VALUES ({placeholders})",
        list(d.values()),
    )
    conn.commit()
    return get_import_template(conn, cur.lastrowid)  # type: ignore[return-value]


def update_import_template(
    conn: sqlite3.Connection, template_id: int, data: ImportTemplateUpdate
) -> Optional[dict[str, Any]]:
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        return get_import_template(conn, template_id)
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    conn.execute(
        f"UPDATE tb_import_template SET {set_clause} WHERE template_id = ?",
        list(updates.values()) + [template_id],
    )
    conn.commit()
    return get_import_template(conn, template_id)


def delete_import_template(conn: sqlite3.Connection, template_id: int) -> bool:
    cur = conn.execute(
        "DELETE FROM tb_import_template WHERE template_id = ?", (template_id,)
    )
    conn.commit()
    return cur.rowcount > 0


# ──────────────────────────────────────────────
# 导出模板
# ──────────────────────────────────────────────

def get_export_templates(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM tb_export_template ORDER BY template_id DESC"
    ).fetchall()
    return [dict(r) for r in rows]


def get_export_template(
    conn: sqlite3.Connection, template_id: int
) -> Optional[dict[str, Any]]:
    row = conn.execute(
        "SELECT * FROM tb_export_template WHERE template_id = ?", (template_id,)
    ).fetchone()
    return dict(row) if row else None


def create_export_template(
    conn: sqlite3.Connection, data: ExportTemplateCreate
) -> dict[str, Any]:
    d = data.model_dump()
    cols = ", ".join(d.keys())
    placeholders = ", ".join("?" * len(d))
    cur = conn.execute(
        f"INSERT INTO tb_export_template ({cols}) VALUES ({placeholders})",
        list(d.values()),
    )
    conn.commit()
    return get_export_template(conn, cur.lastrowid)  # type: ignore[return-value]


def update_export_template(
    conn: sqlite3.Connection, template_id: int, data: ExportTemplateUpdate
) -> Optional[dict[str, Any]]:
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        return get_export_template(conn, template_id)
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    conn.execute(
        f"UPDATE tb_export_template SET {set_clause} WHERE template_id = ?",
        list(updates.values()) + [template_id],
    )
    conn.commit()
    return get_export_template(conn, template_id)


def delete_export_template(conn: sqlite3.Connection, template_id: int) -> bool:
    cur = conn.execute(
        "DELETE FROM tb_export_template WHERE template_id = ?", (template_id,)
    )
    conn.commit()
    return cur.rowcount > 0
