import {
  App,
  Button,
  Divider,
  Dropdown,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import {
  fetchImportTemplates,
  saveImportTemplate,
  type ImportTemplate,
} from "../../api/import";
import { FIELD_MAP, type FieldKey } from "../../utils/fieldMap";

const { Text } = Typography;

const IGNORE_VALUE = "__ignore__";

interface MappingRow {
  sys_key: FieldKey;
  sys_label: string;
  excel_col: string; // "__ignore__" | 列名
  auto: boolean;
}

interface Props {
  headers: string[];
  onConfirm: (mapping: Record<string, string>) => void;
  onBack: () => void;
  importing: boolean;
}

export default function Step3Mapping({
  headers,
  onConfirm,
  onBack,
  importing,
}: Props) {
  const { message } = App.useApp();
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  // 初始化映射（自动匹配）
  useEffect(() => {
    const initial: MappingRow[] = FIELD_MAP.map((f) => {
      const exactMatch = headers.find((h) => h === f.label);
      return {
        sys_key: f.key as FieldKey,
        sys_label: f.label,
        excel_col: exactMatch ?? IGNORE_VALUE,
        auto: !!exactMatch,
      };
    });
    setRows(initial);
  }, [headers]);

  useEffect(() => {
    fetchImportTemplates()
      .then(setTemplates)
      .catch(() => {});
  }, []);

  function applyTemplate(tpl: ImportTemplate) {
    let mapping: Record<string, string> = {};
    try {
      mapping = JSON.parse(tpl.mapping_json) as Record<string, string>;
    } catch {
      message.error("模板格式错误");
      return;
    }
    setRows((prev) =>
      prev.map((r) => {
        const col = mapping[r.sys_key];
        if (col !== undefined) {
          return { ...r, excel_col: col, auto: false };
        }
        return r;
      })
    );
    message.success(`已加载模板「${tpl.template_name}」`);
  }

  function updateRow(sys_key: FieldKey, excel_col: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.sys_key === sys_key ? { ...r, excel_col, auto: false } : r
      )
    );
  }

  async function handleSaveTemplate() {
    if (!newTemplateName.trim()) {
      message.warning("请输入模板名称");
      return;
    }
    const mapping = buildMapping();
    setSavingTemplate(true);
    try {
      await saveImportTemplate(newTemplateName.trim(), mapping);
      message.success("模板已保存");
      setSaveModalOpen(false);
      setNewTemplateName("");
      const updated = await fetchImportTemplates();
      setTemplates(updated);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSavingTemplate(false);
    }
  }

  function buildMapping(): Record<string, string> {
    const m: Record<string, string> = {};
    for (const r of rows) {
      m[r.sys_key] = r.excel_col;
    }
    return m;
  }

  // 统计
  const autoCount = rows.filter((r) => r.auto && r.excel_col !== IGNORE_VALUE).length;
  const manualCount = rows.filter((r) => !r.auto && r.excel_col !== IGNORE_VALUE).length;
  const ignoreCount = rows.filter((r) => r.excel_col === IGNORE_VALUE).length;

  const colOptions = [
    { label: "— 忽略 —", value: IGNORE_VALUE },
    ...headers.map((h) => ({ label: h, value: h })),
  ];

  // 示例数据（第一个 preview_row 暂时无法传入，用列名代替）
  const columns: ColumnsType<MappingRow> = [
    {
      title: "系统字段",
      dataIndex: "sys_label",
      width: 160,
      render: (label: string) => <Text strong>{label}</Text>,
    },
    {
      title: "Excel 列",
      dataIndex: "excel_col",
      width: 220,
      render: (_: string, record: MappingRow) => (
        <Select
          size="small"
          style={{ width: "100%" }}
          value={record.excel_col}
          options={colOptions}
          onChange={(val: string) => updateRow(record.sys_key, val)}
          showSearch
          filterOption={(input, option) =>
            (option?.label as string)
              .toLowerCase()
              .includes(input.toLowerCase())
          }
        />
      ),
    },
    {
      title: "匹配",
      width: 90,
      render: (_: unknown, record: MappingRow) => {
        if (record.excel_col === IGNORE_VALUE) {
          return <Tag>— 忽略</Tag>;
        }
        return record.auto ? (
          <Tag color="blue">⚡ 自动</Tag>
        ) : (
          <Tag color="orange">⚠️ 手动</Tag>
        );
      },
    },
  ];

  return (
    <div style={{ padding: "16px 0" }}>
      {/* 顶部：加载模板 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Dropdown
          menu={{
            items: templates.map((t) => ({
              key: t.template_id,
              label: t.template_name,
              onClick: () => applyTemplate(t),
            })),
          }}
          disabled={templates.length === 0}
        >
          <Button>
            调用已有模板 ▼{" "}
            {templates.length === 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                （暂无）
              </Text>
            )}
          </Button>
        </Dropdown>
        <Space>
          <Text type="secondary">
            ⚡ 自动 {autoCount} 项 &nbsp;/&nbsp; ⚠️ 手动 {manualCount} 项
            &nbsp;/&nbsp; — 忽略 {ignoreCount} 项
          </Text>
        </Space>
      </div>

      <Table<MappingRow>
        size="small"
        columns={columns}
        dataSource={rows}
        rowKey="sys_key"
        pagination={false}
        scroll={{ y: 360 }}
        bordered
      />

      <Divider />

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Space>
          <Button onClick={onBack}>上一步</Button>
          <Button onClick={() => setSaveModalOpen(true)}>保存为映射模板</Button>
        </Space>
        <Button
          type="primary"
          loading={importing}
          onClick={() => onConfirm(buildMapping())}
        >
          开始导入
        </Button>
      </div>

      {/* 保存模板弹窗 */}
      <Modal
        title="保存映射模板"
        open={saveModalOpen}
        onOk={handleSaveTemplate}
        onCancel={() => setSaveModalOpen(false)}
        confirmLoading={savingTemplate}
        okText="保存"
        cancelText="取消"
      >
        <Input
          placeholder="请输入模板名称"
          value={newTemplateName}
          onChange={(e) => setNewTemplateName(e.target.value)}
          onPressEnter={handleSaveTemplate}
        />
      </Modal>
    </div>
  );
}
