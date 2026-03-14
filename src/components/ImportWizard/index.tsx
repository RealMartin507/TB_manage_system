import { CheckCircleOutlined } from "@ant-design/icons";
import { App, Modal, Result, Steps, Typography } from "antd";
import { useState } from "react";
import {
  executeImport,
  type ImportResult,
  type UploadResult,
} from "../../api/import";
import Step1Upload from "./Step1Upload";
import Step2Sheet, { type Step2Values } from "./Step2Sheet";
import Step3Mapping from "./Step3Mapping";

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type WizardStep = 0 | 1 | 2 | 3; // 0:上传 1:Sheet配置 2:字段映射 3:完成

export default function ImportWizard({ open, onClose, onSuccess }: Props) {
  const { message } = App.useApp();
  const [step, setStep] = useState<WizardStep>(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [step2Values, setStep2Values] = useState<Step2Values | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  function reset() {
    setStep(0);
    setUploadResult(null);
    setStep2Values(null);
    setHeaders([]);
    setImportResult(null);
    setImporting(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleUploadDone(result: UploadResult) {
    setUploadResult(result);
    setStep2Values(null); // 重新上传时清空上一次的 step2 值
    setStep(1);
  }

  function handleStep2Done(values: Step2Values, hdrs: string[]) {
    setStep2Values(values);
    setHeaders(hdrs);
    setStep(2);
  }

  async function handleImport(mapping: Record<string, string>) {
    if (!uploadResult || !step2Values) return;

    setImporting(true);
    try {
      const result = await executeImport({
        session_id: uploadResult.session_id,
        sheet_name: step2Values.sheet_name,
        header_row: step2Values.header_row,
        data_start_row: step2Values.data_start_row,
        data_end_row: step2Values.data_end_row,
        source: step2Values.source,
        task_name: step2Values.source,
        platform_id: null,
        mapping,
      });
      setImportResult(result);
      setStep(3);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "导入失败");
    } finally {
      setImporting(false);
    }
  }

  function handleFinish() {
    reset();
    onClose();
    onSuccess();
  }

  const stepItems = [
    { title: "上传文件" },
    { title: "选择 Sheet" },
    { title: "字段映射" },
    { title: "完成" },
  ];

  return (
    <Modal
      title="导入 Excel"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={860}
      destroyOnClose
    >
      <Steps
        current={step}
        items={stepItems}
        style={{ marginBottom: 24 }}
        size="small"
      />

      {step === 0 && <Step1Upload onDone={handleUploadDone} />}

      {step === 1 && uploadResult && (
        <>
          {/* 文件信息 */}
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">文件：</Text>
            <Text strong>{uploadResult.filename}</Text>
            <Text type="secondary" style={{ marginLeft: 12 }}>
              ({(uploadResult.file_size / 1024).toFixed(1)} KB)
            </Text>
          </div>
          <Step2Sheet
            uploadResult={uploadResult}
            initialValues={step2Values}
            onDone={handleStep2Done}
          />
        </>
      )}

      {step === 2 && (
        <Step3Mapping
          headers={headers}
          onConfirm={handleImport}
          onBack={() => setStep(1)}
          importing={importing}
        />
      )}

      {step === 3 && importResult && (
        <Result
          icon={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
          title="导入完成"
          subTitle={
            <div>
              <p>新增图斑 {importResult.added} 条</p>
              <p>追加任务关联 {importResult.updated} 条</p>
              <p>忽略 {importResult.skipped} 条</p>
            </div>
          }
          extra={[
            <button
              key="finish"
              className="ant-btn ant-btn-primary"
              onClick={handleFinish}
            >
              完成
            </button>,
          ]}
        />
      )}
    </Modal>
  );
}
