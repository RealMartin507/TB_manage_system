import axios from "axios";

export type StatusSummary = "pending" | "done" | "rejected";

export interface TaskSummaryItem {
  id: number;
  task_id: number;
  task_name: string;
  source: string | null;
  platform_name: string | null;
  platform_url: string | null;
  created_time: string | null;
  deadline: string | null;
  report_status: string;
}

export interface PlotWithTaskSummary {
  plot_id: string;
  township: string | null;
  village: string | null;
  area: number | null;
  farmland_area: number | null;
  basic_farmland: number | null;
  plot_type: string | null;
  land_before: string | null;
  land_after: string | null;
  task_count: number;
  status_summary: StatusSummary;
  tasks: TaskSummaryItem[];
}

export interface PlotsPageData {
  items: PlotWithTaskSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface PlatformStat {
  platform_id: number;
  platform_name: string;
  count: number;
}

export interface TaskSourceStat {
  task_id: number;
  source: string;
  count: number;
  done_count: number;
  pending_count: number;
  rejected_count: number;
  tentative_count: number;
  unprocessed_count: number;
}

export interface PlotsStats {
  total: number;
  done_count: number;
  pending_count: number;
  rejected_count: number;
  tentative_count: number;
  unprocessed_count: number;
  platforms: PlatformStat[];
  task_sources: TaskSourceStat[];
}

export interface PlotsFilter {
  page: number;
  page_size: number;
  search: string;
  status_filter: string;
  platform_id: number;
  task_id: number;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiError {
  success: false;
  error: string;
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;

export async function fetchPlots(filter: PlotsFilter): Promise<PlotsPageData> {
  const resp = await axios.get<ApiResponse<PlotsPageData>>("/api/v1/plots", {
    params: filter,
  });
  if (!resp.data.success) {
    throw new Error((resp.data as ApiError).error);
  }
  return (resp.data as ApiSuccess<PlotsPageData>).data;
}

export async function fetchPlotsStats(): Promise<PlotsStats> {
  const resp = await axios.get<ApiResponse<PlotsStats>>("/api/v1/plots/stats");
  if (!resp.data.success) {
    throw new Error((resp.data as ApiError).error);
  }
  return (resp.data as ApiSuccess<PlotsStats>).data;
}

export async function clearAllPlots(): Promise<{ deleted: number }> {
  const resp = await axios.delete<ApiResponse<{ deleted: number }>>("/api/v1/plots");
  if (!resp.data.success) {
    throw new Error((resp.data as ApiError).error);
  }
  return (resp.data as ApiSuccess<{ deleted: number }>).data;
}

// ── 图斑详情相关类型 ────────────────────────────

export interface PlotTaskDetail {
  id: number;
  plot_id: string;
  task_id: number;
  source: string | null;
  created_time: string | null;
  deadline: string | null;
  platform_id: number | null;
  platform_name: string | null;
  platform_url: string | null;
  seq_no: number | null;
  project_name: string | null;
  land_unit: string | null;
  approval_doc: string | null;
  land_supply_doc: string | null;
  legality: string | null;
  internal_review: string | null;
  field_survey: string | null;
  report_status: string;
  reject_reason: string | null;
  archive_status: string | null;
  dispatch: string | null;
  overlap_situation: string | null;
  overlap_ratio: number | null;
  overlap_area: number | null;
  remark: string | null;
}

export interface PlotDetail {
  plot_id: string;
  township: string | null;
  village: string | null;
  area: number | null;
  farmland_area: number | null;
  basic_farmland: number | null;
  plot_type: string | null;
  land_before: string | null;
  land_after: string | null;
  folder_path: string | null;
  created_at: string | null;
  tasks: PlotTaskDetail[];
}

export interface PlotUpdatePayload {
  township?: string | null;
  village?: string | null;
  area?: number | null;
  farmland_area?: number | null;
  basic_farmland?: number | null;
  plot_type?: string | null;
  land_before?: string | null;
  land_after?: string | null;
  folder_path?: string | null;
}

export interface PlotTaskUpdatePayload {
  seq_no?: number | null;
  project_name?: string | null;
  land_unit?: string | null;
  approval_doc?: string | null;
  land_supply_doc?: string | null;
  legality?: string | null;
  internal_review?: string | null;
  field_survey?: string | null;
  report_status?: string | null;
  reject_reason?: string | null;
  archive_status?: string | null;
  dispatch?: string | null;
  overlap_situation?: string | null;
  overlap_ratio?: number | null;
  overlap_area?: number | null;
  remark?: string | null;
}

export async function fetchPlotDetail(plotId: string): Promise<PlotDetail> {
  const resp = await axios.get<ApiResponse<PlotDetail>>(`/api/v1/plots/${plotId}`);
  if (!resp.data.success) {
    throw new Error((resp.data as ApiError).error);
  }
  return (resp.data as ApiSuccess<PlotDetail>).data;
}

export async function fetchPlotTaskDetail(plotTaskId: number): Promise<PlotTaskDetail> {
  const resp = await axios.get<ApiResponse<PlotTaskDetail>>(`/api/v1/plot-tasks/${plotTaskId}`);
  if (!resp.data.success) {
    throw new Error((resp.data as ApiError).error);
  }
  return (resp.data as ApiSuccess<PlotTaskDetail>).data;
}

export async function updatePlot(
  plotId: string,
  payload: PlotUpdatePayload,
): Promise<PlotDetail> {
  const resp = await axios.put<ApiResponse<PlotDetail>>(`/api/v1/plots/${plotId}`, payload);
  if (!resp.data.success) {
    throw new Error((resp.data as ApiError).error);
  }
  return (resp.data as ApiSuccess<PlotDetail>).data;
}

export async function updatePlotTask(
  plotTaskId: number,
  payload: PlotTaskUpdatePayload,
): Promise<PlotTaskDetail> {
  const resp = await axios.put<ApiResponse<PlotTaskDetail>>(
    `/api/v1/plot-tasks/${plotTaskId}`,
    payload,
  );
  if (!resp.data.success) {
    throw new Error((resp.data as ApiError).error);
  }
  return (resp.data as ApiSuccess<PlotTaskDetail>).data;
}
