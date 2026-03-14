import axios from "axios";

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiError {
  success: false;
  error: string;
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── 任务列表（用于选择任务来源）────────────────

export interface TaskItem {
  task_id: number;
  task_name: string;
  source: string | null;
  created_time: string | null;
  deadline: string | null;
}

export async function fetchTasks(): Promise<TaskItem[]> {
  const resp = await axios.get<ApiResponse<TaskItem[]>>("/api/v1/tasks");
  if (!resp.data.success) {
    throw new Error((resp.data as ApiError).error);
  }
  return (resp.data as ApiSuccess<TaskItem[]>).data;
}

// ── 导出模板 ────────────────────────────────────

export interface ExportTemplate {
  template_id: number;
  template_name: string;
  fields_json: string;
  created_at: string | null;
}

export async function fetchExportTemplates(): Promise<ExportTemplate[]> {
  const resp = await axios.get<ApiResponse<ExportTemplate[]>>("/api/v1/export-templates");
  if (!resp.data.success) {
    throw new Error((resp.data as ApiError).error);
  }
  return (resp.data as ApiSuccess<ExportTemplate[]>).data;
}

export async function createExportTemplate(
  template_name: string,
  fields: string[],
): Promise<ExportTemplate> {
  const resp = await axios.post<ApiResponse<ExportTemplate>>("/api/v1/export-templates", {
    template_name,
    fields_json: JSON.stringify(fields),
  });
  if (!resp.data.success) {
    throw new Error((resp.data as ApiError).error);
  }
  return (resp.data as ApiSuccess<ExportTemplate>).data;
}

// ── 导出执行 ────────────────────────────────────

export interface ExportExecuteResult {
  download_token: string;
  filename: string;
  row_count: number;
}

export async function executeExport(
  task_ids: number[],
  fields: string[],
): Promise<ExportExecuteResult> {
  const resp = await axios.post<ApiResponse<ExportExecuteResult>>("/api/v1/export/execute", {
    task_ids,
    fields,
  });
  if (!resp.data.success) {
    throw new Error((resp.data as ApiError).error);
  }
  return (resp.data as ApiSuccess<ExportExecuteResult>).data;
}

/**
 * 触发文件下载：通过构造 <a> 标签指向 download 接口。
 * pywebview 环境下后端为 http://127.0.0.1:8000，需使用完整 URL。
 */
export function triggerDownload(token: string, filename: string): void {
  const base = window.location.hostname === "localhost" ? "http://127.0.0.1:8000" : "";
  const url = `${base}/api/v1/export/download/${token}`;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
