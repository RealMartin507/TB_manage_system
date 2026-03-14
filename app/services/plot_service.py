"""图斑表 CRUD 服务层"""
import sqlite3
from typing import Any, Literal, Optional

from app.schemas import PlotCreate, PlotUpdate, PlotWithTaskSummary, TaskSummaryItem, PlotsPageData, PlotsStats, PlatformStat, TaskSourceStat, PlotDetailOut, PlotTaskDetailOut


def _compute_status_summary(tasks: list[dict[str, Any]]) -> Literal["pending", "done", "rejected"]:
    """根据任务列表计算填报状态聚合（用于图斑行的 status_summary 字段）"""
    if not tasks:
        return "done"
    statuses = [t.get("report_status", "未处理") for t in tasks]
    if any(s == "退回" for s in statuses):
        return "rejected"
    if any(s == "待报" for s in statuses):
        return "pending"
    return "done"


# 合法填报状态集合（用于筛选面板的 status_filter 直接匹配 report_status）
_STATUS_FILTER_MAP: dict[str, str] = {
    "done": "已报",
    "pending": "待报",
    "rejected": "退回",
    "tentative": "待定",
    "unprocessed": "未处理",
}


def get_plots_overview(
    conn: sqlite3.Connection,
    *,
    page: int = 1,
    page_size: int = 20,
    search: str = "",
    status_filter: str = "",
    platform_id: int = 0,
    task_id: int = 0,
) -> PlotsPageData:
    """图斑总览列表（含任务摘要和状态聚合）"""
    # 先查满足条件的 plot_id 集合
    conditions: list[str] = []
    params: list[Any] = []

    if search:
        conditions.append("(p.plot_id LIKE ? OR p.township LIKE ? OR p.village LIKE ?)")
        like = f"%{search}%"
        params.extend([like, like, like])

    if platform_id:
        conditions.append("""
            p.plot_id IN (
                SELECT pt.plot_id FROM tb_plot_task pt
                JOIN tb_task t ON t.task_id = pt.task_id
                WHERE t.platform_id = ?
            )
        """)
        params.append(platform_id)

    if task_id:
        conditions.append("p.plot_id IN (SELECT pt.plot_id FROM tb_plot_task pt WHERE pt.task_id = ?)")
        params.append(task_id)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    # 先获取全部匹配的 plot_id（用于 status_filter 过滤）
    all_rows = conn.execute(
        f"SELECT p.* FROM tb_plot p {where} ORDER BY p.created_at DESC",
        params,
    ).fetchall()

    # 批量查询所有相关任务
    all_plot_ids = [dict(r)["plot_id"] for r in all_rows]

    tasks_by_plot: dict[str, list[dict[str, Any]]] = {}
    if all_plot_ids:
        placeholders = ",".join("?" * len(all_plot_ids))
        task_rows = conn.execute(
            f"""
            SELECT pt.id, pt.plot_id, pt.task_id, pt.report_status,
                   t.task_name, t.source, t.created_time, t.deadline,
                   pl.platform_name, pl.platform_url
            FROM tb_plot_task pt
            JOIN tb_task t ON t.task_id = pt.task_id
            LEFT JOIN tb_platform pl ON pl.platform_id = t.platform_id
            WHERE pt.plot_id IN ({placeholders})
            ORDER BY pt.seq_no
            """,
            all_plot_ids,
        ).fetchall()
        for tr in task_rows:
            td = dict(tr)
            pid = td["plot_id"]
            tasks_by_plot.setdefault(pid, []).append(td)

    # 构建结果并应用 status_filter
    items: list[PlotWithTaskSummary] = []
    for row in all_rows:
        plot = dict(row)
        pid = plot["plot_id"]
        plot_tasks = tasks_by_plot.get(pid, [])
        summary = _compute_status_summary(plot_tasks)

        if status_filter and status_filter in _STATUS_FILTER_MAP:
            # 精确匹配：图斑下任意任务含该 report_status 才保留
            target = _STATUS_FILTER_MAP[status_filter]
            if not any(t.get("report_status") == target for t in plot_tasks):
                continue

        items.append(PlotWithTaskSummary(
            plot_id=pid,
            township=plot.get("township"),
            village=plot.get("village"),
            area=plot.get("area"),
            farmland_area=plot.get("farmland_area"),
            basic_farmland=plot.get("basic_farmland"),
            plot_type=plot.get("plot_type"),
            land_before=plot.get("land_before"),
            land_after=plot.get("land_after"),
            task_count=len(plot_tasks),
            status_summary=summary,
            tasks=[
                TaskSummaryItem(
                    id=t["id"],
                    task_id=t["task_id"],
                    task_name=t["task_name"],
                    source=t.get("source"),
                    platform_name=t.get("platform_name"),
                    platform_url=t.get("platform_url"),
                    created_time=t.get("created_time"),
                    deadline=t.get("deadline"),
                    report_status=t.get("report_status", "待报"),
                )
                for t in plot_tasks
            ],
        ))

    total = len(items)
    offset = (page - 1) * page_size
    page_items = items[offset: offset + page_size]

    return PlotsPageData(
        items=page_items,
        total=total,
        page=page,
        page_size=page_size,
    )


def get_plots_stats(conn: sqlite3.Connection) -> PlotsStats:
    """获取筛选面板统计数据"""
    total: int = conn.execute("SELECT COUNT(*) FROM tb_plot").fetchone()[0]

    # 按 report_status 统计含该状态的图斑数（一个图斑可能被多个计数覆盖）
    def _count_plots_with_status(status: str) -> int:
        row = conn.execute(
            "SELECT COUNT(DISTINCT plot_id) FROM tb_plot_task WHERE report_status = ?",
            (status,),
        ).fetchone()
        return row[0] if row else 0

    done_count = _count_plots_with_status("已报")
    pending_count = _count_plots_with_status("待报")
    rejected_count = _count_plots_with_status("退回")
    tentative_count = _count_plots_with_status("待定")
    unprocessed_count = _count_plots_with_status("未处理")

    # 按平台统计图斑数
    platform_rows = conn.execute("""
        SELECT pl.platform_id, pl.platform_name, COUNT(DISTINCT pt.plot_id) AS cnt
        FROM tb_platform pl
        LEFT JOIN tb_task t ON t.platform_id = pl.platform_id
        LEFT JOIN tb_plot_task pt ON pt.task_id = t.task_id
        GROUP BY pl.platform_id
        ORDER BY pl.sort_order, pl.platform_name
    """).fetchall()

    # 按任务来源统计图斑数及各状态数
    task_source_rows = conn.execute("""
        SELECT t.task_id, COALESCE(t.source, t.task_name) AS source,
               COUNT(DISTINCT pt.plot_id) AS cnt,
               COUNT(DISTINCT CASE WHEN pt.report_status = '已报' THEN pt.plot_id END) AS done_cnt,
               COUNT(DISTINCT CASE WHEN pt.report_status = '待报' THEN pt.plot_id END) AS pending_cnt,
               COUNT(DISTINCT CASE WHEN pt.report_status = '退回' THEN pt.plot_id END) AS rejected_cnt,
               COUNT(DISTINCT CASE WHEN pt.report_status = '待定' THEN pt.plot_id END) AS tentative_cnt,
               COUNT(DISTINCT CASE WHEN pt.report_status = '未处理' THEN pt.plot_id END) AS unprocessed_cnt
        FROM tb_task t
        JOIN tb_plot_task pt ON pt.task_id = t.task_id
        GROUP BY t.task_id
        ORDER BY t.import_time DESC
    """).fetchall()

    return PlotsStats(
        total=total,
        done_count=done_count,
        pending_count=pending_count,
        rejected_count=rejected_count,
        tentative_count=tentative_count,
        unprocessed_count=unprocessed_count,
        platforms=[
            PlatformStat(
                platform_id=r["platform_id"],
                platform_name=r["platform_name"],
                count=r["cnt"],
            )
            for r in platform_rows
        ],
        task_sources=[
            TaskSourceStat(
                task_id=r["task_id"],
                source=r["source"],
                count=r["cnt"],
                done_count=r["done_cnt"],
                pending_count=r["pending_cnt"],
                rejected_count=r["rejected_cnt"],
                tentative_count=r["tentative_cnt"],
                unprocessed_count=r["unprocessed_cnt"],
            )
            for r in task_source_rows
        ],
    )


def get_plots(
    conn: sqlite3.Connection,
    *,
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    township: Optional[str] = None,
    plot_type: Optional[str] = None,
) -> dict[str, Any]:
    conditions: list[str] = []
    params: list[Any] = []

    if search:
        conditions.append(
            "(plot_id LIKE ? OR village LIKE ? OR project_name LIKE ?)"
        )
        like = f"%{search}%"
        params.extend([like, like, like])
    if township:
        conditions.append("township = ?")
        params.append(township)
    if plot_type:
        conditions.append("plot_type = ?")
        params.append(plot_type)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    total: int = conn.execute(
        f"SELECT COUNT(*) FROM tb_plot {where}", params
    ).fetchone()[0]

    offset = (page - 1) * page_size
    rows = conn.execute(
        f"SELECT * FROM tb_plot {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        params + [page_size, offset],
    ).fetchall()

    return {"total": total, "items": [dict(r) for r in rows]}


def get_plot(conn: sqlite3.Connection, plot_id: str) -> Optional[dict[str, Any]]:
    row = conn.execute(
        "SELECT * FROM tb_plot WHERE plot_id = ?", (plot_id,)
    ).fetchone()
    if row is None:
        return None
    plot = dict(row)
    tasks = conn.execute(
        "SELECT * FROM tb_plot_task WHERE plot_id = ? ORDER BY seq_no",
        (plot_id,),
    ).fetchall()
    plot["tasks"] = [dict(t) for t in tasks]
    return plot


def get_plot_detail(conn: sqlite3.Connection, plot_id: str) -> Optional[PlotDetailOut]:
    """获取图斑详情，含任务完整字段（task + platform 联查）"""
    row = conn.execute(
        "SELECT * FROM tb_plot WHERE plot_id = ?", (plot_id,)
    ).fetchone()
    if row is None:
        return None
    plot = dict(row)

    task_rows = conn.execute(
        """
        SELECT pt.*,
               t.source, t.created_time, t.deadline,
               t.platform_id,
               pl.platform_name, pl.platform_url
        FROM tb_plot_task pt
        JOIN tb_task t ON t.task_id = pt.task_id
        LEFT JOIN tb_platform pl ON pl.platform_id = t.platform_id
        WHERE pt.plot_id = ?
        ORDER BY pt.seq_no
        """,
        (plot_id,),
    ).fetchall()

    tasks = [PlotTaskDetailOut(**dict(tr)) for tr in task_rows]
    return PlotDetailOut(**plot, tasks=tasks)


def create_plot(conn: sqlite3.Connection, data: PlotCreate) -> dict[str, Any]:
    d = data.model_dump()
    cols = ", ".join(d.keys())
    placeholders = ", ".join("?" * len(d))
    conn.execute(
        f"INSERT INTO tb_plot ({cols}) VALUES ({placeholders})", list(d.values())
    )
    conn.commit()
    return get_plot(conn, data.plot_id)  # type: ignore[return-value]


def update_plot(
    conn: sqlite3.Connection, plot_id: str, data: PlotUpdate
) -> Optional[dict[str, Any]]:
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        return get_plot(conn, plot_id)
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    conn.execute(
        f"UPDATE tb_plot SET {set_clause} WHERE plot_id = ?",
        list(updates.values()) + [plot_id],
    )
    conn.commit()
    return get_plot(conn, plot_id)


def delete_plot(conn: sqlite3.Connection, plot_id: str) -> bool:
    cur = conn.execute("DELETE FROM tb_plot WHERE plot_id = ?", (plot_id,))
    conn.commit()
    return cur.rowcount > 0


def clear_all_plots(conn: sqlite3.Connection) -> int:
    cur = conn.execute("DELETE FROM tb_plot")
    conn.commit()
    return cur.rowcount
