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

function unwrap<T>(resp: ApiResponse<T>): T {
  if (!resp.success) {
    throw new Error((resp as ApiError).error);
  }
  return (resp as ApiSuccess<T>).data;
}

// ── 类型定义 ──────────────────────────────────

export interface SheetInfo {
  name: string;
  row_count: number;
}

export interface UploadResult {
  session_id: string;
  filename: string;
  file_size: number;
  sheets: SheetInfo[];
}

export interface PreviewResult {
  headers: string[];
  preview_rows: string[][];
  total_rows: number;
}

export interface ExecuteImportParams {
  session_id: string;
  sheet_name: string;
  header_row: number;
  data_start_row: number;
  data_end_row: number;
  source: string;
  task_name: string;
  platform_id: number | null;
  mapping: Record<string, string>;
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
}

export interface ImportTemplate {
  template_id: number;
  template_name: string;
  mapping_json: string;
  created_at: string | null;
}

// ── API 函数 ──────────────────────────────────

export async function uploadExcel(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const resp = await axios.post<ApiResponse<UploadResult>>(
    "/api/v1/import/upload",
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return unwrap(resp.data);
}

export async function previewSheet(params: {
  session_id: string;
  sheet_name: string;
  header_row: number;
}): Promise<PreviewResult> {
  const resp = await axios.post<ApiResponse<PreviewResult>>(
    "/api/v1/import/preview",
    params
  );
  return unwrap(resp.data);
}

export async function executeImport(
  params: ExecuteImportParams
): Promise<ImportResult> {
  const resp = await axios.post<ApiResponse<ImportResult>>(
    "/api/v1/import/execute",
    params
  );
  return unwrap(resp.data);
}

export async function fetchImportTemplates(): Promise<ImportTemplate[]> {
  const resp = await axios.get<ApiResponse<ImportTemplate[]>>(
    "/api/v1/import-templates"
  );
  return unwrap(resp.data);
}

export async function saveImportTemplate(
  template_name: string,
  mapping: Record<string, string>
): Promise<ImportTemplate> {
  const resp = await axios.post<ApiResponse<ImportTemplate>>(
    "/api/v1/import-templates",
    { template_name, mapping_json: JSON.stringify(mapping) }
  );
  return unwrap(resp.data);
}
