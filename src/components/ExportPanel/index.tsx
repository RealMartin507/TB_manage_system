import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Divider,
  Dropdown,
  Input,
  Modal,
  Space,
  Typography,
  message,
} from "antd";
import type { CheckboxChangeEvent } from "antd/es/checkbox";
import { DownOutlined } from "@ant-design/icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  fetchTasks,
  fetchExportTemplates,
  createExportTemplate,
  executeExport,
  triggerDownload,
  TaskItem,
  ExportTemplate,
} from "@/api/export";
import { FIELD_MAP, FieldKey } from "@/utils/fieldMap";

const ALL_FIELD_KEYS: FieldKey[] = FIELD_MAP.map((f) => f.key);

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ExportPanel({ open, onClose }: Props) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  // ── 任务列表 ──────────────────────────────────
  const { data: tasks = [] } = useQuery<TaskItem[]>({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
    enabled: open,
  });

  // 去重：同一个 task_id 只显示一次
  const uniqueTasks: TaskItem[] = tasks.filter(
    (t, i, arr) => arr.findIndex((x) => x.task_id === t.task_id) === i,
  );

  // ── 导出模板列表 ──────────────────────────────
  const { data: templates = [], refetch: refetchTemplates } = useQuery<ExportTemplate[]>({
    queryKey: ["export-templates"],
    queryFn: fetchExportTemplates,
    enabled: open,
  });

  // ── 选中的任务 ────────────────────────────────
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const taskAllChecked = selectedTaskIds.length === uniqueTasks.length && uniqueTasks.length > 0;
  const taskIndeterminate = selectedTaskIds.length > 0 && !taskAllChecked;

  // ── 选中的字段 ────────────────────────────────
  const [selectedFields, setSelectedFields] = useState<FieldKey[]>(ALL_FIELD_KEYS);
  const fieldAllChecked = selectedFields.length === ALL_FIELD_KEYS.length;
  const fieldIndeterminate = selectedFields.length > 0 && !fieldAllChecked;

  // ── 保存模板弹框 ──────────────────────────────
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // ── 重置面板状态 ──────────────────────────────
  useEffect(() => {
    if (open) {
      setSelectedTaskIds([]);
      setSelectedFields(ALL_FIELD_KEYS);
      setTemplateName("");
    }
  }, [open]);

  // ── 文件名预览 ────────────────────────────────
  const filenamePreview = (() => {
    if (selectedTaskIds.length === 0) return null;
    const sources = Array.from(
      new Set(
        selectedTaskIds
          .map((id) => uniqueTasks.find((t) => t.task_id === id)?.source)
          .filter((s): s is string => !!s),
      ),
    );
    if (sources.length === 1) return `${sources[0]}_${today}.xlsx`;
    return `多任务导出_${today}.xlsx`;
  })();

  // ── 导出 mutation ─────────────────────────────
  const exportMut = useMutation({
    mutationFn: () => executeExport(selectedTaskIds, selectedFields),
    onSuccess: (result) => {
      triggerDownload(result.download_token, result.filename);
      message.success(`导出成功，共 ${result.row_count} 条记录`);
      onClose();
    },
    onError: (err: Error) => {
      message.error(`导出失败：${err.message}`);
    },
  });

  // ── 保存模板 mutation ─────────────────────────
  const saveTplMut = useMutation({
    mutationFn: () => createExportTemplate(templateName.trim(), selectedFields),
    onSuccess: () => {
      message.success("模板保存成功");
      setSaveModalOpen(false);
      setTemplateName("");
      refetchTemplates();
    },
    onError: (err: Error) => {
      message.error(`保存失败：${err.message}`);
    },
  });

  // ── 调用模板 ──────────────────────────────────
  function applyTemplate(tpl: ExportTemplate) {
    try {
      const fields: FieldKey[] = JSON.parse(tpl.fields_json);
      setSelectedFields(fields);
    } catch {
      message.error("模板数据格式错误");
    }
  }

  // ── 任务全选 ──────────────────────────────────
  function onTaskCheckAll(e: CheckboxChangeEvent) {
    setSelectedTaskIds(e.target.checked ? uniqueTasks.map((t) => t.task_id) : []);
  }

  // ── 字段全选 ──────────────────────────────────
  function onFieldCheckAll(checked: boolean) {
    setSelectedFields(checked ? ALL_FIELD_KEYS : []);
  }

  // ── 渲染 ──────────────────────────────────────
  return (
    <>
      <Modal
        open={open}
        title="导出数据"
        width={640}
        maskClosable={false}
        footer={null}
        onCancel={onClose}
      >
        {/* 任务来源选择 */}
        <Typography.Text strong>选择任务来源（可多选）</Typography.Text>
        <div style={{ marginTop: 8, marginBottom: 4 }}>
          <Checkbox
            indeterminate={taskIndeterminate}
            checked={taskAllChecked}
            onChange={onTaskCheckAll}
          >
            全选
          </Checkbox>
        </div>
        <Checkbox.Group
          value={selectedTaskIds}
          onChange={(vals) =>
            setSelectedTaskIds(vals as number[])
          }
          style={{ display: "flex", flexDirection: "column", gap: 4 }}
        >
          {uniqueTasks.map((t) => (
            <Checkbox key={t.task_id} value={t.task_id}>
              {t.source || t.task_name}
            </Checkbox>
          ))}
        </Checkbox.Group>

        <Divider style={{ margin: "12px 0" }} />

        {/* 导出字段 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Typography.Text strong style={{ flex: 1 }}>
            导出字段
          </Typography.Text>
          <Dropdown
            menu={{
              items: templates.map((tpl) => ({
                key: tpl.template_id,
                label: tpl.template_name,
                onClick: () => applyTemplate(tpl),
              })),
              ...(templates.length === 0 && {
                items: [{ key: "empty", label: "暂无模板", disabled: true }],
              }),
            }}
          >
            <Button size="small">
              调用模板 <DownOutlined />
            </Button>
          </Dropdown>
          <Button
            size="small"
            onClick={() => onFieldCheckAll(true)}
            disabled={fieldAllChecked}
          >
            全选
          </Button>
          <Button
            size="small"
            onClick={() => onFieldCheckAll(false)}
            disabled={selectedFields.length === 0}
          >
            全不选
          </Button>
        </div>

        <div style={{ marginBottom: 4 }}>
          <Checkbox
            indeterminate={fieldIndeterminate}
            checked={fieldAllChecked}
            onChange={(e) => onFieldCheckAll(e.target.checked)}
          >
            全选
          </Checkbox>
        </div>

        <Checkbox.Group
          value={selectedFields}
          onChange={(vals) =>
            setSelectedFields(vals as FieldKey[])
          }
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "4px 0",
          }}
        >
          {FIELD_MAP.map((f) => (
            <Checkbox key={f.key} value={f.key}>
              {f.label}
            </Checkbox>
          ))}
        </Checkbox.Group>

        <Divider style={{ margin: "12px 0" }} />

        {/* 文件名预览 */}
        <div style={{ marginBottom: 16 }}>
          <Typography.Text type="secondary">输出文件名：</Typography.Text>
          {filenamePreview ? (
            <Typography.Text code>{filenamePreview}</Typography.Text>
          ) : (
            <Typography.Text type="secondary" italic>
              请先选择任务来源
            </Typography.Text>
          )}
        </div>

        {/* 底部操作栏 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Button
            onClick={() => setSaveModalOpen(true)}
            disabled={selectedFields.length === 0}
          >
            保存为导出模板
          </Button>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button
              type="primary"
              loading={exportMut.isPending}
              disabled={selectedTaskIds.length === 0 || selectedFields.length === 0}
              onClick={() => exportMut.mutate()}
            >
              确认导出
            </Button>
          </Space>
        </div>
      </Modal>

      {/* 保存模板弹框 */}
      <Modal
        open={saveModalOpen}
        title="保存为导出模板"
        width={360}
        onCancel={() => {
          setSaveModalOpen(false);
          setTemplateName("");
        }}
        onOk={() => {
          if (!templateName.trim()) {
            message.warning("请输入模板名称");
            return;
          }
          saveTplMut.mutate();
        }}
        confirmLoading={saveTplMut.isPending}
        okText="保存"
        cancelText="取消"
      >
        <Input
          placeholder="请输入模板名称"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          onPressEnter={() => {
            if (!templateName.trim()) return;
            saveTplMut.mutate();
          }}
        />
      </Modal>
    </>
  );
}
