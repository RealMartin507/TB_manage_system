import { useState, useEffect, useCallback } from "react";
import {
  Drawer,
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
  Modal,
} from "antd";
import { FolderOpenOutlined, PlusOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  fetchPlotDetail,
  updatePlot,
  updatePlotTask,
} from "../../api/plots";
import type { PlotDetail, PlotTaskDetail, PlotUpdatePayload, PlotTaskUpdatePayload } from "../../api/plots";
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
    return <Text>{value ?? "—"}</Text>;
  }

  if (!editing) {
    return (
      <Text
        style={{ cursor: "pointer", minHeight: 22, display: "inline-block" }}
        onClick={() => setEditing(true)}
      >
        {value ?? <Text type="secondary">—</Text>}
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
      value={local as string}
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

// ── 图斑基本信息区域 ──────────────────────────────
interface PlotFieldsProps {
  plot: PlotDetail;
  plotDiff: PlotUpdatePayload;
  onPlotChange: (key: keyof PlotUpdatePayload, value: string | number | null) => void;
}

function PlotInfoSection({ plot, plotDiff, onPlotChange }: PlotFieldsProps) {
  function val<K extends keyof PlotUpdatePayload>(key: K): PlotDetail[K & keyof PlotDetail] | null {
    if (key in plotDiff && plotDiff[key] !== undefined) return plotDiff[key] as PlotDetail[K & keyof PlotDetail];
    return plot[key as keyof PlotDetail] as PlotDetail[K & keyof PlotDetail] ?? null;
  }

  const fields: Array<{ key: keyof PlotUpdatePayload; label: string; type?: "text" | "number"; readOnly?: boolean }> = [
    { key: "township", label: "乡镇名称" },
    { key: "village", label: "村名称" },
    { key: "area", label: "监测面积", type: "number" },
    { key: "farmland_area", label: "耕地面积", type: "number" },
    { key: "basic_farmland", label: "占基本农田面积", type: "number" },
    { key: "plot_type", label: "图斑类型" },
    { key: "land_before", label: "变化前地类" },
    { key: "land_after", label: "变化后地类" },
  ];

  return (
    <>
      <Divider orientation="left" style={{ margin: "12px 0 8px" }}>图斑基本信息</Divider>
      <Row gutter={[16, 8]}>
        {/* 监测编号只读 */}
        <Col span={12}>
          <Row>
            <Col span={10}><Text type="secondary">监测编号</Text></Col>
            <Col span={14}><Text strong>{plot.plot_id}</Text></Col>
          </Row>
        </Col>
        {fields.map(({ key, label, type, readOnly }) => (
          <Col span={12} key={key}>
            <Row>
              <Col span={10}><Text type="secondary">{label}</Text></Col>
              <Col span={14}>
                <EditableCell
                  value={val(key) as string | number | null}
                  type={type}
                  readOnly={readOnly}
                  onChange={(v) => onPlotChange(key, v)}
                />
              </Col>
            </Row>
          </Col>
        ))}
      </Row>
    </>
  );
}

// ── 关联层字段区域 ────────────────────────────────
interface TaskSectionProps {
  task: PlotTaskDetail;
  index: number;
  total: number;
  taskDiff: PlotTaskUpdatePayload;
  onTaskChange: (id: number, key: keyof PlotTaskUpdatePayload, value: string | number | null) => void;
  onStatusChange: (id: number, status: string) => void;
}

function TaskSection({ task, index, total, taskDiff, onTaskChange, onStatusChange }: TaskSectionProps) {
  function val<K extends keyof PlotTaskUpdatePayload>(key: K): PlotTaskDetail[K & keyof PlotTaskDetail] | null {
    if (key in taskDiff && taskDiff[key] !== undefined) return taskDiff[key] as PlotTaskDetail[K & keyof PlotTaskDetail];
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
    <div style={{ marginBottom: 16 }}>
      <Divider orientation="left" style={{ margin: "12px 0 8px" }}>
        <Space>
          <Text>
            任务来源 {index + 1}/{total}：{task.source ?? task.task_id}
          </Text>
          <ReportStatusBadge status={reportStatus} />
          {task.platform_url && (
            <Button
              type="link"
              size="small"
              style={{ padding: 0 }}
              onClick={() => window.open(task.platform_url!, "_blank")}
            >
              去填报↗
            </Button>
          )}
        </Space>
      </Divider>

      <Row gutter={[16, 8]}>
        {/* 填报状态 - 独占一行 */}
        <Col span={24}>
          <Row align="middle">
            <Col span={5}><Text type="secondary">填报</Text></Col>
            <Col span={19}>
              <Segmented
                size="small"
                options={[...REPORT_STATUS_OPTIONS]}
                value={reportStatus as ReportStatus}
                onChange={(v) => onStatusChange(task.id, v as string)}
              />
            </Col>
          </Row>
        </Col>

        {/* 退回原因 - 仅退回状态显示 */}
        {showRejectReason && (
          <Col span={24}>
            <Row align="top">
              <Col span={5}><Text type="secondary">退回原因</Text></Col>
              <Col span={19}>
                <Input.TextArea
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  value={(val("reject_reason") as string) ?? ""}
                  onChange={(e) => onTaskChange(task.id, "reject_reason", e.target.value || null)}
                  placeholder="请填写退回原因..."
                />
              </Col>
            </Row>
          </Col>
        )}

        {/* 调度字段 - 独占一行 */}
        <Col span={24}>
          <Row align="top">
            <Col span={5}><Text type="secondary">调度</Text></Col>
            <Col span={19}>
              <DispatchEditor
                value={val("dispatch") as string | null}
                onChange={(v) => onTaskChange(task.id, "dispatch", v)}
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
                  onChange={(v) => onTaskChange(task.id, key, v)}
                />
              </Col>
            </Row>
          </Col>
        ))}

        {/* 任务层只读字段 */}
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
        <Col span={12}>
          <Row>
            <Col span={10}><Text type="secondary">平台名称</Text></Col>
            <Col span={14}><Text>{task.platform_name ?? "—"}</Text></Col>
          </Row>
        </Col>
      </Row>
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────
export interface PlotDetailDrawerProps {
  open: boolean;
  plotId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function PlotDetailDrawer({ open, plotId, onClose, onSaved }: PlotDetailDrawerProps) {
  const [plotDiff, setPlotDiff] = useState<PlotUpdatePayload>({});
  const [taskDiffs, setTaskDiffs] = useState<Record<number, PlotTaskUpdatePayload>>({});
  const [saving, setSaving] = useState(false);

  const hasChanges = Object.keys(plotDiff).length > 0 || Object.keys(taskDiffs).length > 0;

  const { data: plot, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["plot-detail", plotId],
    queryFn: () => fetchPlotDetail(plotId!),
    enabled: open && plotId != null,
  });

  // 关闭时重置 diff
  useEffect(() => {
    if (!open) {
      setPlotDiff({});
      setTaskDiffs({});
    }
  }, [open]);

  const handlePlotChange = useCallback(
    (key: keyof PlotUpdatePayload, value: string | number | null) => {
      setPlotDiff((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleTaskChange = useCallback(
    (id: number, key: keyof PlotTaskUpdatePayload, value: string | number | null) => {
      setTaskDiffs((prev) => ({
        ...prev,
        [id]: { ...prev[id], [key]: value },
      }));
    },
    [],
  );

  // 填报状态切换：立即保存 + 同步 diff
  const handleStatusChange = useCallback(
    async (id: number, status: string) => {
      const prevStatus = plot?.tasks.find((t) => t.id === id)?.report_status;
      // 切离退回：清空退回原因
      const patch: PlotTaskUpdatePayload = { report_status: status };
      if (prevStatus === "退回" && status !== "退回") {
        patch.reject_reason = null;
      }
      // 立即更新 diff（用于 UI 联动）
      setTaskDiffs((prev) => ({
        ...prev,
        [id]: { ...prev[id], ...patch },
      }));
      // 立即保存
      try {
        await updatePlotTask(id, patch);
      } catch (e) {
        void message.error(`填报状态保存失败：${(e as Error).message}`);
      }
    },
    [plot],
  );

  const handleSave = useCallback(async () => {
    if (!plot) return;
    setSaving(true);
    let anyError = false;

    if (Object.keys(plotDiff).length > 0) {
      try {
        await updatePlot(plot.plot_id, plotDiff);
      } catch (e) {
        anyError = true;
        void message.error(`图斑信息保存失败：${(e as Error).message}`);
      }
    }

    for (const [idStr, diff] of Object.entries(taskDiffs)) {
      if (Object.keys(diff).length === 0) continue;
      // 跳过已经实时保存的 report_status（但仍保存其他字段）
      const { report_status: _rs, ...rest } = diff;
      const toSave = _rs === undefined ? diff : rest;
      if (Object.keys(toSave).length === 0) continue;
      try {
        await updatePlotTask(Number(idStr), toSave);
      } catch (e) {
        anyError = true;
        void message.error(`任务数据保存失败：${(e as Error).message}`);
      }
    }

    setSaving(false);
    if (!anyError) {
      setPlotDiff({});
      setTaskDiffs({});
      void refetch();
      onSaved();
    }
  }, [plot, plotDiff, taskDiffs, refetch, onSaved]);

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

  const titleExtra = (
    <Space>
      <Button
        icon={<FolderOpenOutlined />}
        size="small"
        onClick={() => console.log("打开资料 plot_id:", plotId)}
      >
        打开资料
      </Button>
      {hasChanges && (
        <Button
          type="primary"
          size="small"
          loading={saving}
          onClick={() => void handleSave()}
        >
          保存
        </Button>
      )}
    </Space>
  );

  return (
    <Drawer
      open={open}
      placement="right"
      width="65%"
      maskClosable={false}
      destroyOnClose
      title={
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <span>
            图斑详情{plot ? `　${plot.plot_id}` : ""}
          </span>
          {titleExtra}
        </Space>
      }
      onClose={handleClose}
    >
      {isLoading && (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Spin size="large" />
        </div>
      )}

      {isError && (
        <Alert type="error" message={`加载失败：${(error as Error).message}`} />
      )}

      {plot && (
        <div>
          <PlotInfoSection
            plot={plot}
            plotDiff={plotDiff}
            onPlotChange={handlePlotChange}
          />

          {plot.tasks.map((task, idx) => (
            <TaskSection
              key={task.id}
              task={task}
              index={idx}
              total={plot.tasks.length}
              taskDiff={taskDiffs[task.id] ?? {}}
              onTaskChange={handleTaskChange}
              onStatusChange={(id, status) => void handleStatusChange(id, status)}
            />
          ))}

          {plot.tasks.length === 0 && (
            <Text type="secondary" style={{ display: "block", marginTop: 24, textAlign: "center" }}>
              该图斑暂无关联任务
            </Text>
          )}
        </div>
      )}
    </Drawer>
  );
}
