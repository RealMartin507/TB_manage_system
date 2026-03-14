/**
 * 系统字段常量定义（28个字段）
 * key   = 数据库字段名
 * label = 中文显示名
 */

export type FieldKey =
  | "seq_no"
  | "plot_id"
  | "source"
  | "township"
  | "village"
  | "area"
  | "farmland_area"
  | "basic_farmland"
  | "plot_type"
  | "land_before"
  | "land_after"
  | "project_name"
  | "land_unit"
  | "approval_doc"
  | "land_supply_doc"
  | "legality"
  | "internal_review"
  | "field_survey"
  | "report_status"
  | "reject_reason"
  | "created_time"
  | "deadline"
  | "archive_status"
  | "dispatch"
  | "overlap_situation"
  | "overlap_ratio"
  | "overlap_area"
  | "remark";

export interface FieldMeta {
  key: FieldKey;
  label: string;
}

export const FIELD_MAP = [
  { key: "seq_no",           label: "序号" },
  { key: "plot_id",          label: "监测编号" },
  { key: "source",           label: "任务来源" },
  { key: "township",         label: "乡镇名称" },
  { key: "village",          label: "村名称" },
  { key: "area",             label: "监测面积" },
  { key: "farmland_area",    label: "耕地面积" },
  { key: "basic_farmland",   label: "占基本农田面积" },
  { key: "plot_type",        label: "图斑类型" },
  { key: "land_before",      label: "变化前地类" },
  { key: "land_after",       label: "变化后地类" },
  { key: "project_name",     label: "项目名称" },
  { key: "land_unit",        label: "用地单位" },
  { key: "approval_doc",     label: "批单" },
  { key: "land_supply_doc",  label: "供地资料" },
  { key: "legality",         label: "合法性判定" },
  { key: "internal_review",  label: "内审" },
  { key: "field_survey",     label: "外业组调查说明" },
  { key: "report_status",    label: "填报" },
  { key: "reject_reason",    label: "退回原因" },
  { key: "created_time",     label: "任务建立时间" },
  { key: "deadline",         label: "任务截止时间" },
  { key: "archive_status",   label: "存档" },
  { key: "dispatch",         label: "调度" },
  { key: "overlap_situation",label: "批单套合情况" },
  { key: "overlap_ratio",    label: "批单套合比例" },
  { key: "overlap_area",     label: "套合面积" },
  { key: "remark",           label: "备注" },
] as const satisfies ReadonlyArray<FieldMeta>;

/** 通过字段 key 快速查找中文名 */
export const FIELD_LABEL: Readonly<Record<FieldKey, string>> = Object.fromEntries(
  FIELD_MAP.map(({ key, label }) => [key, label])
) as Readonly<Record<FieldKey, string>>;
