import { InboxOutlined } from "@ant-design/icons";
import { App, Typography, Upload } from "antd";
import type { RcFile, UploadProps } from "antd/es/upload";
import { useState } from "react";
import { uploadExcel, type UploadResult } from "../../api/import";

const { Dragger } = Upload;
const { Text } = Typography;

interface Props {
  onDone: (result: UploadResult) => void;
}

export default function Step1Upload({ onDone }: Props) {
  const { message } = App.useApp();
  const [uploading, setUploading] = useState(false);

  const beforeUpload: UploadProps["beforeUpload"] = (file: RcFile) => {
    const isExcel =
      file.type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.type === "application/vnd.ms-excel" ||
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".xls");

    if (!isExcel) {
      message.error("只支持 .xlsx / .xls 格式");
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const customRequest: UploadProps["customRequest"] = async (options) => {
    const file = options.file as RcFile;
    setUploading(true);
    try {
      const result = await uploadExcel(file);
      onDone(result);
      options.onSuccess?.(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "上传失败";
      message.error(msg);
      options.onError?.(new Error(msg));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: "24px 0" }}>
      <Dragger
        accept=".xlsx,.xls"
        maxCount={1}
        beforeUpload={beforeUpload}
        customRequest={customRequest}
        showUploadList={false}
        disabled={uploading}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽 Excel 文件到此区域</p>
        <p className="ant-upload-hint">
          <Text type="secondary">支持 .xlsx / .xls 格式，单次导入一个文件</Text>
        </p>
      </Dragger>
    </div>
  );
}
