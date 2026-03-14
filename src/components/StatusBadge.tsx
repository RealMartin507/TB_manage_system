import { Tag } from "antd";
import type { StatusSummary } from "../api/plots";

/** 聚合状态标签（图斑级别） */
export function StatusSummaryBadge({ status }: { status: StatusSummary }) {
  if (status === "rejected") {
    return <Tag color="warning">⚠️ 有退回</Tag>;
  }
  if (status === "pending") {
    return <Tag color="processing">● 有待报</Tag>;
  }
  return <Tag color="success">✓ 全部已报</Tag>;
}

/** 任务级别填报状态标签（5种状态） */
export function ReportStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "已报":
      return <Tag color="success">✓ 已报</Tag>;
    case "待报":
      return <Tag color="processing">● 待报</Tag>;
    case "退回":
      return <Tag color="error">⚠️ 退回</Tag>;
    case "待定":
      return <Tag color="warning">○ 待定</Tag>;
    default:
      return <Tag color="default">— 未处理</Tag>;
  }
}
