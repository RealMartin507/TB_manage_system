import sqlite3
from pathlib import Path
from typing import Generator

DB_PATH = Path(__file__).parent / "tb_manager.db"
MIGRATION_DIR = Path(__file__).parent / "migrations"


def _run_migrations(conn: sqlite3.Connection) -> None:
    """按文件名顺序执行 migrations/ 目录下的 .sql 文件（幂等）。"""
    conn.execute("CREATE TABLE IF NOT EXISTS _migrations (filename TEXT PRIMARY KEY)")
    conn.commit()

    applied: set[str] = {
        row[0]
        for row in conn.execute("SELECT filename FROM _migrations").fetchall()
    }

    for sql_file in sorted(MIGRATION_DIR.glob("*.sql")):
        if sql_file.name in applied:
            continue
        conn.executescript(sql_file.read_text(encoding="utf-8"))
        conn.execute("INSERT INTO _migrations VALUES (?)", (sql_file.name,))
        conn.commit()


def get_db() -> Generator[sqlite3.Connection, None, None]:
    """FastAPI 依赖注入：提供带 row_factory 的数据库连接。"""
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    """应用启动时调用：确保数据库和所有迁移已执行。"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        _run_migrations(conn)
    finally:
        conn.close()
