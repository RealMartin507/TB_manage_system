import { useState, useEffect, useCallback } from "react";
import {
  Modal,
  Button,
  Spin,
  Alert,
  Divider,
  Row,
  Col,
  Input,
  InputNumber,
  Segmented,
  Tag,
  Select,
  Space,
  Typography,
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  fetchPlotTaskDetail,
  updatePlot,
  updatePlotTask,
} from "../../api/plots";
import type { PlotTaskDetail, PlotUpdatePayload, PlotTaskUpdatePayload } from "../../api/plots";
import { ReportStatusBadge } from "../StatusBadge";

const { Text } = Typography;

// ── 填报状态枚举 ──────────────────────────────────
const REPORT_STATUS_OPTIONS = ["待处理", "待报", "已报", "退回", "待定"] as const;
type ReportStatus = (typeof REPORT_STATUS_OPTIONS)[number];

// ── 调度选项 ──────────────────────────────────────
const DISPATCH_OPTIONS = ["市局调度", "省级调度", "本级调度", "部级调度", "武汉局调度"];

// ── 工具函数 ──────────────────────────────────────
function parseDispatch(val: string | null | undefined): string[] {
  if (!val) return [];
  return val.split(",").filter(Boolean);
}

function formatDate(val: string | null | undefined): string {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── 可编辑字段组件 ────────────────────────────────
interface EditableCellProps {
  value: string | number | null | undefined;
  type?: "text" | "number";
  onChange: (v: string | number | null) => void;
  readOnly?: boolean;
}

function EditableCell({ value, type = "text", onChange, readOnly = false }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState<string | number | null>(value ?? null);

  useEffect(() => {
    setLocal(value ?? null);
  }, [value]);

  if (readOnly) {
    return <Text>{value != null ? String(value) : "—"}</Text>;
  }

  if (!editing) {
    return (
      <Text
        style={{ cursor: "pointer", minHeight: 22, display: "inline-block" }}
        onClick={() => setEditing(true)}
      >
        {value != null ? String(value) : <Text type="secondary">—</Text>}
      </Text>
    );
  }

  const handleBlur = () => {
    setEditing(false);
    onChange(local);
  };

  if (type === "number") {
    return (
      <InputNumber
        autoFocus
        value={local as number | null}
        size="small"
        style={{ width: "100%" }}
        onChange={(v) => setLocal(v)}
        onBlur={handleBlur}
        onPressEnter={handleBlur}
      />
    );
  }

  return (
    <Input
      autoFocus
      value={(local as string) ?? ""}
      size="small"
      onChange={(e) => setLocal(e.target.value)}
      onBlur={handleBlur}
      onPressEnter={handleBlur}
    />
  );
}

// ── 调度标签编辑器 ────────────────────────────────
interface DispatchEditorProps {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
}

function DispatchEditor({ value, onChange }: DispatchEditorProps) {
  const [selectOpen, setSelectOpen] = useState(false);
  const selected = parseDispatch(value);

  function toggle(item: string) {
    const next = selected.includes(item)
      ? selected.filter((s) => s !== item)
      : [...selected, item];
    onChange(next.length ? next.join(",") : null);
  }

  function handleSelectChange(vals: string[]) {
    onChange(vals.length ? vals.join(",") : null);
    setSelectOpen(false);
  }

  return (
    <Space size={4} wrap>
      {selected.map((s) => (
        <Tag
          key={s}
          closable
          onClose={() => toggle(s)}
          style={{ cursor: "pointer" }}
        >
          {s}
        </Tag>
      ))}
      {!selectOpen ? (
        <Tag
          icon={<PlusOutlined />}
          style={{ cursor: "pointer", borderStyle: "dashed" }}
          onClick={() => setSelectOpen(true)}
        >
          添加
        </Tag>
      ) : (
        <Select
          autoFocus
          mode="multiple"
          size="small"
          style={{ minWidth: 160 }}
          options={DISPATCH_OPTIONS.map((o) => ({ label: o, value: o }))}
          value={selected}
          onChange={handleSelectChange}
          onBlur={() => setSelectOpen(false)}
          open
        />
      )}
    </Space>
  );
}

// ── 图斑只读区域 ──────────────────────────────────
function PlotReadonlySection({ task }: { task: PlotTaskDetail }) {
  const fields: Array<{ key: keyof PlotTaskDetail; label: string }> = [
    { key: "plot_id", label: "监测编号" },
  ];

  // 使用从关联记录中能获取到的图斑层字段（只读展示）
  return (
    <>
      <Divider orientation="left" style={{ margin: "12px 0 8px" }}>图斑基本信息（只读）</Divider>
      <Row gutter={[16, 8]} style={{ background: "#fafafa", padding: "8px 0", borderRadius: 4 }}>
        <Col span={12}>
          <Row>
            <Col span={10}><Text type="secondary">监测编号</Text></Col>
            <Col span={14}><Text>{task.plot_id}</Text></Col>
          </Row>
        </Col>
        <Col span={12}>
          <Row>
            <Col span={10}><Text type="secondary">任务来源</Text></Col>
            <Col span={14}><Text>{task.source ?? "—"}</Text></Col>
          </Row>
        </Col>
        <Col span={12}>
          <Row>
            <Col span={10}><Text type="secondary">平台名称</Text></Col>
            <Col span={14}><Text>{task.platform_name ?? "—"}</Text></Col>
          </Row>
        </Col>
        <Col span={12}>
          <Row>
            <Col span={10}><Text type="secondary">任务建立时间</Text></Col>
            <Col span={14}><Text>{formatDate(task.created_time)}</Text></Col>
          </Row>
        </Col>
        <Col span={12}>
          <Row>
            <Col span={10}><Text type="secondary">任务截止时间</Text></Col>
            <Col span={14}><Text>{formatDate(task.deadline)}</Text></Col>
          </Row>
        </Col>
      </Row>
    </>
  );
}

// ── 本任务填报信息（可编辑区域）────────────────────
interface TaskEditSectionProps {
  task: PlotTaskDetail;
  diff: PlotTaskUpdatePayload;
  onFieldChange: (key: keyof PlotTaskUpdatePayload, value: string | number | null) => void;
  onStatusChange: (status: string) => void;
}

function TaskEditSection({ task, diff, onFieldChange, onStatusChange }: TaskEditSectionProps) {
  function val<K extends keyof PlotTaskUpdatePayload>(key: K): PlotTaskDetail[K & keyof PlotTaskDetail] | null {
    if (key in diff && diff[key] !== undefined) return diff[key] as PlotTaskDetail[K & keyof PlotTaskDetail];
    return task[key as keyof PlotTaskDetail] as PlotTaskDetail[K & keyof PlotTaskDetail] ?? null;
  }

  const reportStatus = (val("report_status") as string) || task.report_status;
  const showRejectReason = reportStatus === "退回";

  const textFields: Array<{ key: keyof PlotTaskUpdatePayload; label: string; type?: "text" | "number" }> = [
    { key: "seq_no", label: "序号", type: "number" },
    { key: "project_name", label: "项目名称" },
    { key: "land_unit", label: "用地单位" },
    { key: "approval_doc", label: "批单" },
    { key: "land_supply_doc", label: "供地资料" },
    { key: "legality", label: "合法性判定" },
    { key: "internal_review", label: "内审" },
    { key: "field_survey", label: "外业组调查说明" },
    { key: "archive_status", label: "存档" },
    { key: "overlap_situation", label: "批单套合情况" },
    { key: "overlap_ratio", label: "批单套合比例", type: "number" },
    { key: "overlap_area", label: "套合面积", type: "number" },
    { key: "remark", label: "备注" },
  ];

  return (
    <>
      <Divider orientation="left" style={{ margin: "12px 0 8px" }}>本任务填报信息</Divider>
      <Row gutter={[16, 8]}>
        {/* 填报状态 */}
        <Col span={24}>
          <Row align="middle">
            <Col span={5}><Text type="secondary">填报</Text></Col>
            <Col span={19}>
              <Segmented
                size="small"
                options={[...REPORT_STATUS_OPTIONS]}
                value={reportStatus as ReportStatus}
                onChange={(v) => onStatusChange(v as string)}
              />
            </Col>
          </Row>
        </Col>

        {/* 退回原因 */}
        {showRejectReason && (
          <Col span={24}>
            <Row align="top">
              <Col span={5}><Text type="secondary">退回原因</Text></Col>
              <Col span={19}>
                <Input.TextArea
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  value={(val("reject_reason") as string) ?? ""}
                  onChange={(e) => onFieldChange("reject_reason", e.target.value || null)}
                  placeholder="请填写退回原因..."
                />
              </Col>
            </Row>
          </Col>
        )}

        {/* 调度字段 */}
        <Col span={24}>
          <Row align="top">
            <Col span={5}><Text type="secondary">调度</Text></Col>
            <Col span={19}>
              <DispatchEditor
                value={val("dispatch") as string | null}
                onChange={(v) => onFieldChange("dispatch", v)}
              />
            </Col>
          </Row>
        </Col>

        {/* 两列文本字段 */}
        {textFields.map(({ key, label, type }) => (
          <Col span={12} key={key}>
            <Row>
              <Col span={10}><Text type="secondary">{label}</Text></Col>
              <Col span={14}>
                <EditableCell
                  value={val(key) as string | number | null}
                  type={type}
                  onChange={(v) => onFieldChange(key, v)}
                />
              </Col>
            </Row>
          </Col>
        ))}
      </Row>
    </>
  );
}

// ── 主组件 ────────────────────────────────────────
export interface PlotTaskDetailModalProps {
  open: boolean;
  plotTaskId: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function PlotTaskDetailModal({ open, plotTaskId, onClose, onSaved }: PlotTaskDetailModalProps) {
  const [diff, setDiff] = useState<PlotTaskUpdatePayload>({});
  const [saving, setSaving] = useState(false);

  const hasChanges = Object.keys(diff).length > 0;

  const { data: task, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["plot-task-detail", plotTaskId],
    queryFn: () => fetchPlotTaskDetail(plotTaskId!),
    enabled: open && plotTaskId != null,
  });

  useEffect(() => {
    if (!open) {
      setDiff({});
    }
  }, [open]);

  const handleFieldChange = useCallback(
    (key: keyof PlotTaskUpdatePayload, value: string | number | null) => {
      setDiff((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // 填报状态切换：立即保存 + 更新 diff
  const handleStatusChange = useCallback(
    async (status: string) => {
      const patch: PlotTaskUpdatePayload = { report_status: status };
      if (task?.report_status === "退回" && status !== "退回") {
        patch.reject_reason = null;
        // 同步清空 reject_reason diff
        setDiff((prev) => {
          const next = { ...prev, ...patch };
          return next;
        });
      } else {
        setDiff((prev) => ({ ...prev, report_status: status }));
      }
      try {
        await updatePlotTask(plotTaskId!, patch);
      } catch (e) {
        void message.error(`填报状态保存失败：${(e as Error).message}`);
      }
    },
    [task, plotTaskId],
  );

  const handleSave = useCallback(async () => {
    if (!task) return;
    setSaving(true);

    // report_status 已实时保存，过滤掉后再 PUT 其他字段
    const { report_status: _rs, ...rest } = diff;
    const hasOtherChanges = Object.keys(rest).length > 0;

    try {
      if (hasOtherChanges) {
        await updatePlotTask(task.id, rest);
      }
      setDiff({});
      void refetch();
      onSaved();
    } catch (e) {
      void message.error(`保存失败：${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }, [task, diff, refetch, onSaved]);

  const handleClose = useCallback(() => {
    if (hasChanges) {
      Modal.confirm({
        title: "有未保存的修改，确认关闭吗？",
        okText: "确认关闭",
        cancelText: "取消",
        onOk: onClose,
      });
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);

  const reportStatus = (diff.report_status as string) ?? task?.report_status ?? "待处理";

  const modalTitle = task
    ? `${task.source ?? task.task_id} · 详情`
    : "任务详情";

  const titleNode = (
    <Space align="center">
      <span>{modalTitle}</span>
      {task && (
        <>
          <Text type="secondary" style={{ fontSize: 13 }}>{task.plot_id}</Text>
          <ReportStatusBadge status={reportStatus} />
        </>
      )}
    </Space>
  );

  const footer = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Button
        type="default"
        disabled={!task?.platform_url}
        onClick={() => {
          if (task?.platform_url) window.open(task.platform_url, "_blank");
        }}
      >
        去填报↗
      </Button>
      <Space>
        <Button onClick={handleClose}>取消</Button>
        <Button
          type="primary"
          loading={saving}
          onClick={() => void handleSave()}
        >
          保存
        </Button>
      </Space>
    </div>
  );

  return (
    <Modal
      open={open}
      title={titleNode}
      width={720}
      style={{ top: 40 }}
      maskClosable={false}
      destroyOnClose
      footer={footer}
      onCancel={handleClose}
    >
      <div style={{ maxHeight: "75vh", overflowY: "auto", padding: "4px 0" }}>
        {isLoading && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin size="large" />
          </div>
        )}

        {isError && (
          <Alert type="error" message={`加载失败：${(error as Error).message}`} />
        )}

        {task && (
          <>
            <PlotReadonlySection task={task} />
            <TaskEditSection
              task={task}
              diff={diff}
              onFieldChange={handleFieldChange}
              onStatusChange={(s) => void handleStatusChange(s)}
            />
          </>
        )}
      </div>
    </Modal>
  );
}
