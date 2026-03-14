"""
所有 Pydantic schema 统一定义。
命名规则：<Model>Base / <Model>Create / <Model>Update / <Model>Out
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict


# ──────────────────────────────────────────────
# 通用响应包装
# ──────────────────────────────────────────────

class SuccessResponse(BaseModel):
    success: bool = True
    data: Any


class ErrorResponse(BaseModel):
    success: bool = False
    error: str


class PaginatedData(BaseModel):
    total: int
    items: list[Any]


# ──────────────────────────────────────────────
# tb_plot  图斑
# ──────────────────────────────────────────────

class PlotBase(BaseModel):
    township: Optional[str] = None
    village: Optional[str] = None
    area: Optional[float] = None
    farmland_area: Optional[float] = None
    basic_farmland: Optional[float] = None
    plot_type: Optional[str] = None
    land_before: Optional[str] = None
    land_after: Optional[str] = None
    folder_path: Optional[str] = None


class PlotCreate(PlotBase):
    plot_id: str


class PlotUpdate(PlotBase):
    pass


class PlotOut(PlotBase):
    model_config = ConfigDict(from_attributes=True)

    plot_id: str
    created_at: Optional[datetime] = None


class PlotDetail(PlotOut):
    """图斑详情：含关联任务列表"""
    tasks: list[PlotTaskOut] = []


# ──────────────────────────────────────────────
# tb_platform  填报平台
# ──────────────────────────────────────────────

class PlatformBase(BaseModel):
    platform_name: str
    platform_url: Optional[str] = None
    sort_order: int = 0


class PlatformCreate(PlatformBase):
    pass


class PlatformUpdate(BaseModel):
    platform_name: Optional[str] = None
    platform_url: Optional[str] = None
    sort_order: Optional[int] = None


class PlatformOut(PlatformBase):
    model_config = ConfigDict(from_attributes=True)

    platform_id: int


# ──────────────────────────────────────────────
# tb_task  任务
# ──────────────────────────────────────────────

class TaskBase(BaseModel):
    task_name: str
    source: Optional[str] = None
    platform_id: Optional[int] = None
    created_time: Optional[date] = None
    deadline: Optional[date] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    task_name: Optional[str] = None
    source: Optional[str] = None
    platform_id: Optional[int] = None
    created_time: Optional[date] = None
    deadline: Optional[date] = None


class TaskOut(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    task_id: int
    import_time: Optional[datetime] = None


# ──────────────────────────────────────────────
# tb_plot_task  图斑-任务关联
# ──────────────────────────────────────────────

class PlotTaskBase(BaseModel):
    seq_no: Optional[int] = None
    project_name: Optional[str] = None
    land_unit: Optional[str] = None
    approval_doc: Optional[str] = None
    land_supply_doc: Optional[str] = None
    legality: Optional[str] = None
    internal_review: Optional[str] = None
    field_survey: Optional[str] = None
    report_status: Optional[str] = "待报"
    reject_reason: Optional[str] = None
    archive_status: Optional[str] = None
    dispatch: Optional[str] = None
    overlap_situation: Optional[str] = None
    overlap_ratio: Optional[float] = None
    overlap_area: Optional[float] = None
    remark: Optional[str] = None


class PlotTaskCreate(PlotTaskBase):
    plot_id: str
    task_id: int


class PlotTaskUpdate(PlotTaskBase):
    pass


class PlotTaskOut(PlotTaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    plot_id: str
    task_id: int


# ──────────────────────────────────────────────
# 图斑详情接口专用 Schema（含任务完整字段）
# ──────────────────────────────────────────────

class PlotTaskDetailOut(PlotTaskBase):
    """单条关联记录的完整详情（含任务层 + 平台层字段）"""
    id: int
    plot_id: str
    task_id: int
    source: Optional[str] = None
    created_time: Optional[date] = None
    deadline: Optional[date] = None
    platform_id: Optional[int] = None
    platform_name: Optional[str] = None
    platform_url: Optional[str] = None


class PlotDetailOut(PlotBase):
    """图斑详情，含关联任务完整列表"""
    plot_id: str
    created_at: Optional[datetime] = None
    tasks: list[PlotTaskDetailOut] = []


# 解决 PlotDetail 中的前向引用
PlotDetail.model_rebuild()


# ──────────────────────────────────────────────
# 图斑总览页专用 Schema
# ──────────────────────────────────────────────

StatusSummary = Literal["pending", "done", "rejected"]


class TaskSummaryItem(BaseModel):
    """任务简要信息（用于图斑总览展开行）"""
    id: int
    task_id: int
    task_name: str
    source: Optional[str] = None
    platform_name: Optional[str] = None
    platform_url: Optional[str] = None
    created_time: Optional[date] = None
    deadline: Optional[date] = None
    report_status: str = "待报"


class PlotWithTaskSummary(BaseModel):
    """图斑总览列表项"""
    plot_id: str
    township: Optional[str] = None
    village: Optional[str] = None
    area: Optional[float] = None
    farmland_area: Optional[float] = None
    basic_farmland: Optional[float] = None
    plot_type: Optional[str] = None
    land_before: Optional[str] = None
    land_after: Optional[str] = None
    task_count: int = 0
    status_summary: StatusSummary = "done"
    tasks: list[TaskSummaryItem] = []


class PlotsPageData(BaseModel):
    """图斑分页数据"""
    items: list[PlotWithTaskSummary]
    total: int
    page: int
    page_size: int


class PlatformStat(BaseModel):
    platform_id: int
    platform_name: str
    count: int


class TaskSourceStat(BaseModel):
    task_id: int
    source: str
    count: int
    done_count: int = 0
    pending_count: int = 0
    rejected_count: int = 0
    tentative_count: int = 0
    unprocessed_count: int = 0


class PlotsStats(BaseModel):
    """筛选面板统计数据"""
    total: int
    done_count: int
    pending_count: int
    rejected_count: int
    tentative_count: int
    unprocessed_count: int
    platforms: list[PlatformStat]
    task_sources: list[TaskSourceStat]


# ──────────────────────────────────────────────
# tb_import_template  导入映射模板
# ──────────────────────────────────────────────

class ImportTemplateBase(BaseModel):
    template_name: str
    mapping_json: str = "{}"


class ImportTemplateCreate(ImportTemplateBase):
    pass


class ImportTemplateUpdate(BaseModel):
    template_name: Optional[str] = None
    mapping_json: Optional[str] = None


class ImportTemplateOut(ImportTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    template_id: int
    created_at: Optional[datetime] = None


# ──────────────────────────────────────────────
# 导入向导相关 Schema
# ──────────────────────────────────────────────

class SheetInfo(BaseModel):
    name: str
    row_count: int


class UploadResult(BaseModel):
    session_id: str
    filename: str
    file_size: int
    sheets: list[SheetInfo]


class PreviewRequest(BaseModel):
    session_id: str
    sheet_name: str
    header_row: int = 1


class PreviewResult(BaseModel):
    headers: list[str]
    preview_rows: list[list[str]]
    total_rows: int


class ExecuteImportRequest(BaseModel):
    session_id: str
    sheet_name: str
    header_row: int
    data_start_row: int
    data_end_row: int
    source: str
    task_name: str
    platform_id: Optional[int] = None
    mapping: dict[str, str]


class ImportResult(BaseModel):
    added: int
    updated: int
    skipped: int


# ──────────────────────────────────────────────
# 导出执行 Schema
# ──────────────────────────────────────────────

class ExportExecuteRequest(BaseModel):
    task_ids: list[int]
    fields: list[str]


class ExportExecuteResult(BaseModel):
    download_token: str
    filename: str
    row_count: int


# ──────────────────────────────────────────────
# tb_export_template  导出模板
# ──────────────────────────────────────────────

class ExportTemplateBase(BaseModel):
    template_name: str
    fields_json: str = "[]"


class ExportTemplateCreate(ExportTemplateBase):
    pass


class ExportTemplateUpdate(BaseModel):
    template_name: Optional[str] = None
    fields_json: Optional[str] = None


class ExportTemplateOut(ExportTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    template_id: int
    created_at: Optional[datetime] = None
