import {
  App,
  Button,
  Col,
  Form,
  InputNumber,
  Radio,
  Row,
  Space,
  Table,
  Typography,
} from "antd";
import { WarningOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { previewSheet, type PreviewResult, type UploadResult } from "../../api/import";

const { Text } = Typography;

export interface Step2Values {
  sheet_name: string;
  header_row: number;
  data_start_row: number;
  data_end_row: number;
  source: string;
}

interface Props {
  uploadResult: UploadResult;
  initialValues?: Step2Values | null;
  onDone: (values: Step2Values, headers: string[]) => void;
}

export default function Step2Sheet({ uploadResult, initialValues, onDone }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<{
    sheet_name: string;
    header_row: number;
    data_start_row: number;
    data_end_row: number;
    source: string;
  }>();

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);

  const defaultSheet = uploadResult.sheets[0]?.name ?? "";
  const defaultSource = uploadResult.filename.replace(/\.(xlsx|xls)$/i, "");

  // 获取当前 Sheet 的总行数
  function getSheetRowCount(sheetName: string): number {
    return uploadResult.sheets.find((s) => s.name === sheetName)?.row_count ?? 0;
  }

  useEffect(() => {
    if (initialValues) {
      // 从上一步返回时，恢复之前填写的值
      form.setFieldsValue(initialValues);
      void handlePreview(initialValues.sheet_name, initialValues.header_row);
    } else {
      form.setFieldsValue({
        sheet_name: defaultSheet,
        header_row: 1,
        data_start_row: 2,
        data_end_row: getSheetRowCount(defaultSheet),
        source: defaultSource,
      });
      void handlePreview(defaultSheet, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePreview(sheetName?: string, headerRow?: number) {
    const vals = form.getFieldsValue();
    const sheet = sheetName ?? vals.sheet_name;
    const hRow = headerRow ?? vals.header_row ?? 1;
    if (!sheet) {
      message.warning("请先选择 Sheet");
      return;
    }
    setLoading(true);
    try {
      const result = await previewSheet({
        session_id: uploadResult.session_id,
        sheet_name: sheet,
        header_row: hRow,
      });
      setPreview(result);
      // 自动计算：数据起始行 = 字段名行 + 1，数据结束行 = Sheet 总行数
      const autoStart = hRow + 1;
      const autoEnd = getSheetRowCount(sheet);
      form.setFieldsValue({
        data_start_row: autoStart,
        data_end_row: autoEnd > 0 ? autoEnd : hRow + result.total_rows,
      });
    } catch (err) {
      message.error(err instanceof Error ? err.message : "预览失败");
    } finally {
      setLoading(false);
    }
  }

  function handleNext() {
    form
      .validateFields()
      .then((vals) => {
        const headers = preview?.headers ?? [];
        onDone(
          {
            sheet_name: vals.sheet_name,
            header_row: vals.header_row,
            data_start_row: vals.data_start_row,
            data_end_row: vals.data_end_row,
            source: vals.source,
          },
          headers
        );
      })
      .catch(() => {});
  }

  const headerRow = form.getFieldValue("header_row") as number ?? 1;

  // 行号列（固定在左侧）
  const rowNumCol: ColumnsType<string[]>[number] = {
    title: "行号",
    key: "row_num",
    width: 60,
    fixed: "left" as const,
    render: (_: unknown, __: string[], idx: number) => (
      <Text type="secondary">{headerRow + idx + 1}</Text>
    ),
  };

  // 动态生成预览表格列
  const dataCols: ColumnsType<string[]> =
    preview?.headers.map((h, i) => ({
      title: h || `列${i + 1}`,
      key: i,
      render: (_: unknown, row: string[]) => row[i] ?? "",
      ellipsis: true,
      width: 120,
    })) ?? [];

  const previewColumns: ColumnsType<string[]> = preview ? [rowNumCol, ...dataCols] : [];

  return (
    <div style={{ padding: "16px 0" }}>
      <Form form={form} layout="vertical">
        {/* Sheet 选择 */}
        <Form.Item
          name="sheet_name"
          label="选择 Sheet"
          rules={[{ required: true, message: "请选择 Sheet" }]}
        >
          <Radio.Group
            onChange={(e) => {
              const sheetName = e.target.value as string;
              const hRow = form.getFieldValue("header_row") as number ?? 1;
              void handlePreview(sheetName, hRow);
            }}
          >
            <Space direction="vertical">
              {uploadResult.sheets.map((s) => (
                <Radio key={s.name} value={s.name}>
                  {s.name}
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    ({s.row_count} 行)
                  </Text>
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        </Form.Item>

        <Row gutter={16} align="bottom">
          {/* 表头行 */}
          <Col>
            <Form.Item
              name="header_row"
              label="字段名所在行"
              rules={[{ required: true }]}
            >
              <InputNumber
                min={1}
                style={{ width: 100 }}
                onChange={(val) => {
                  if (val == null) return;
                  const sheet = form.getFieldValue("sheet_name") as string;
                  void handlePreview(sheet, val);
                }}
              />
            </Form.Item>
          </Col>
          {/* 数据起始行 */}
          <Col>
            <Form.Item
              name="data_start_row"
              label="数据起始行"
              rules={[{ required: true }]}
            >
              <InputNumber min={1} style={{ width: 100 }} />
            </Form.Item>
          </Col>
          {/* 数据结束行 */}
          <Col>
            <Form.Item
              name="data_end_row"
              label="数据结束行"
              rules={[{ required: true }]}
            >
              <InputNumber min={1} style={{ width: 100 }} />
            </Form.Item>
          </Col>
        </Row>

        {/* 任务来源（醒目警示） */}
        <Form.Item
          name="source"
          label={
            <span>
              任务来源
              <Text type="warning" style={{ marginLeft: 8, fontSize: 12 }}>
                <WarningOutlined /> 请确认任务来源，这将作为数据分组依据
              </Text>
            </span>
          }
          rules={[{ required: true, message: "请填写任务来源" }]}
        >
          <input
            className="ant-input"
            style={{
              width: 320,
              padding: "4px 11px",
              border: "1px solid #faad14",
              borderRadius: 6,
              outline: "none",
            }}
            onChange={(e) => form.setFieldValue("source", e.target.value)}
          />
        </Form.Item>
      </Form>

      {/* 预览表格 */}
      {preview && (
        <div style={{ marginTop: 16, userSelect: "text" }}>
          <Text strong>前 20 行预览（共 {preview.total_rows} 行数据）</Text>
          <Table
            style={{ marginTop: 8 }}
            size="small"
            scroll={{ x: "max-content" }}
            columns={previewColumns}
            dataSource={preview.preview_rows}
            rowKey={(_, i) => String(i)}
            pagination={false}
            bordered
          />
        </div>
      )}

      <div style={{ marginTop: 24, textAlign: "right" }}>
        <Button type="primary" onClick={handleNext} disabled={!preview} loading={loading}>
          下一步：字段映射
        </Button>
      </div>
    </div>
  );
}
