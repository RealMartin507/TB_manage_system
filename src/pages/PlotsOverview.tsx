import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import {
  Button,
  Col,
  Input,
  Row,
  Spin,
  Table,
  Typography,
  Alert,
  Space,
  Menu,
  Modal,
  message,
} from "antd";
import { UploadOutlined, DeleteOutlined, ExportOutlined } from "@ant-design/icons";
import ImportWizard from "../components/ImportWizard";
import ExportPanel from "../components/ExportPanel";
import PlotDetailDrawer from "../components/PlotDetailDrawer";
import PlotTaskDetailModal from "../components/PlotTaskDetailModal";
import type { ColumnsType } from "antd/es/table";
import type { ExpandableConfig } from "antd/es/table/interface";
import { useQuery } from "@tanstack/react-query";
import { fetchPlots, fetchPlotsStats, clearAllPlots } from "../api/plots";
import type {
  PlotWithTaskSummary,
  TaskSummaryItem,
  PlotsStats,
} from "../api/plots";
import { useFilterStore } from "../stores/filterStore";
import { ReportStatusBadge } from "../components/StatusBadge";

const { Text } = Typography;

// ────────── 防抖 hook ──────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ────────── 日期格式化 ──────────
function formatDate(val: string | null | undefined): string {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// ────────── 处理状态显示 ──────────
function ProcessStatusCell({ tasks }: { tasks: TaskSummaryItem[] }) {
  if (tasks.length === 0) return <Text type="secondary">—</Text>;
  const unhandledCount = tasks.filter(
    (t) =>
      t.report_status === "待报" ||
      t.report_status === "退回" ||
      t.report_status === "未处理" ||
      t.report_status === "待定",
  ).length;
  if (unhandledCount === 0) {
    return <Text style={{ color: "#52c41a" }}>全部处理完毕</Text>;
  }
  return <Text style={{ color: "#fa8c16" }}>存在未处理-{unhandledCount}</Text>;
}

// ────────── 展开子行：任务列表 ──────────
function TaskSubTable({
  tasks,
  onTaskDetail,
}: {
  tasks: TaskSummaryItem[];
  onTaskDetail: (id: number) => void;
}) {
  const columns: ColumnsType<TaskSummaryItem> = [
    { title: "任务来源", dataIndex: "source", key: "source", width: 120 },
    {
      title: "平台名称",
      dataIndex: "platform_name",
      key: "platform_name",
      width: 120,
    },
    {
      title: "建立时间",
      dataIndex: "created_time",
      key: "created_time",
      width: 110,
      render: (v: string | null) => formatDate(v),
    },
    {
      title: "截止时间",
      dataIndex: "deadline",
      key: "deadline",
      width: 110,
      render: (v: string | null) => formatDate(v),
    },
    {
      title: "填报状态",
      dataIndex: "report_status",
      key: "report_status",
      width: 100,
      render: (v: string) => <ReportStatusBadge status={v} />,
    },
    {
      title: "操作",
      key: "actions",
      width: 160,
      render: (_: unknown, record: TaskSummaryItem) => (
        <Space>
          <Button
            size="small"
            type="link"
            disabled={!record.platform_url}
            onClick={() => {
              if (record.platform_url) {
                window.open(record.platform_url, "_blank");
              }
            }}
          >
            去填报
          </Button>
          <Button
            size="small"
            type="link"
            onClick={() => console.log("资料 plot_task_id:", record.id)}
          >
            资料
          </Button>
          <Button
            size="small"
            type="link"
            onClick={() => onTaskDetail(record.id)}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Table<TaskSummaryItem>
      columns={columns}
      dataSource={tasks}
      rowKey="id"
      size="small"
      pagination={false}
      style={{ marginLeft: 48 }}
    />
  );
}

// ────────── 左侧筛选面板 ──────────
function FilterPanel({ stats }: { stats: PlotsStats | undefined }) {
  const {
    status_filter,
    platform_id,
    task_id,
    setStatusFilter,
    setPlatformId,
    setTaskId,
  } = useFilterStore();

  if (!stats) return <Spin size="small" />;

  // 计算当前选中的 key
  let selectedKey = "all";
  if (platform_id) selectedKey = `platform_${platform_id}`;
  else if (task_id && status_filter)
    selectedKey = `task_status_${task_id}_${status_filter}`;
  else if (task_id) selectedKey = `task_all_${task_id}`;
  else if (status_filter) selectedKey = status_filter;
  else selectedKey = "all";

  const handleSelect = ({ key }: { key: string }) => {
    if (key === "all") {
      setStatusFilter("");
      setPlatformId(0);
      setTaskId(0);
    } else if (key.startsWith("platform_")) {
      setStatusFilter("");
      setTaskId(0);
      setPlatformId(Number(key.replace("platform_", "")));
    } else if (key.startsWith("task_all_")) {
      // task_all_<taskId> 选中任务下全部状态
      setStatusFilter("");
      setPlatformId(0);
      setTaskId(Number(key.replace("task_all_", "")));
    } else if (key.startsWith("task_status_")) {
      // task_status_<taskId>_<status> 选中任务下某状态
      const parts = key.replace("task_status_", "").split("_");
      const tId = Number(parts[0]);
      const st = parts.slice(1).join("_");
      setPlatformId(0);
      setTaskId(tId);
      setStatusFilter(st);
    } else if (key.startsWith("task_")) {
      // task_<id> 点击任务父级，等同于选该任务全部
      setStatusFilter("");
      setPlatformId(0);
      setTaskId(Number(key.replace("task_", "")));
    } else {
      setPlatformId(0);
      setTaskId(0);
      setStatusFilter(key);
    }
  };

  // 全部图斑 + 状态子菜单
  const statusGroupItem = {
    key: "status_group",
    label: (
      <span>
        全部图斑 <Text type="secondary">({stats.total})</Text>
      </span>
    ),
    children: [
      {
        key: "all",
        label: (
          <span>
            全部 <Text type="secondary">({stats.total})</Text>
          </span>
        ),
      },
      {
        key: "done",
        label: (
          <span>
            ✓ 已报 <Text type="secondary">({stats.done_count})</Text>
          </span>
        ),
      },
      {
        key: "pending",
        label: (
          <span>
            ● 待报 <Text type="secondary">({stats.pending_count})</Text>
          </span>
        ),
      },
      {
        key: "rejected",
        label: (
          <span>
            ⚠️ 退回 <Text type="secondary">({stats.rejected_count})</Text>
          </span>
        ),
      },
      {
        key: "tentative",
        label: (
          <span>
            ○ 待定 <Text type="secondary">({stats.tentative_count})</Text>
          </span>
        ),
      },
      {
        key: "unprocessed",
        label: (
          <span>
            — 未处理 <Text type="secondary">({stats.unprocessed_count})</Text>
          </span>
        ),
      },
    ],
  };

  // 按平台筛选
  const platformItems = stats.platforms.map((p) => ({
    key: `platform_${p.platform_id}`,
    label: (
      <span>
        {p.platform_name} <Text type="secondary">({p.count})</Text>
      </span>
    ),
  }));

  // 按任务筛选（可展开显示各状态）
  const taskItems = stats.task_sources.map((t) => ({
    key: `task_${t.task_id}`,
    label: (
      <span>
        {t.source} <Text type="secondary">({t.count})</Text>
      </span>
    ),
    children: [
      {
        key: `task_all_${t.task_id}`,
        label: (
          <span>
            全部 <Text type="secondary">({t.count})</Text>
          </span>
        ),
      },
      {
        key: `task_status_${t.task_id}_done`,
        label: (
          <span>
            ✓ 已报 <Text type="secondary">({t.done_count})</Text>
          </span>
        ),
      },
      {
        key: `task_status_${t.task_id}_pending`,
        label: (
          <span>
            ● 待报 <Text type="secondary">({t.pending_count})</Text>
          </span>
        ),
      },
      {
        key: `task_status_${t.task_id}_rejected`,
        label: (
          <span>
            ⚠️ 退回 <Text type="secondary">({t.rejected_count})</Text>
          </span>
        ),
      },
      {
        key: `task_status_${t.task_id}_tentative`,
        label: (
          <span>
            ○ 待定 <Text type="secondary">({t.tentative_count})</Text>
          </span>
        ),
      },
      {
        key: `task_status_${t.task_id}_unprocessed`,
        label: (
          <span>
            — 未处理 <Text type="secondary">({t.unprocessed_count})</Text>
          </span>
        ),
      },
    ],
  }));

  const allMenuItems = [
    statusGroupItem,
    {
      type: "divider" as const,
      style: { borderColor: "#d0d0d0", borderWidth: 0.5, margin: "8px 0" },
    },
    {
      key: "platform_header",
      type: "group" as const,
      label: (
        <span
          style={{
            fontSize: 12,
            color: "#555",
            fontWeight: 600,
            letterSpacing: 1,
          }}
        >
          按平台筛选
        </span>
      ),
      children: platformItems,
    },
    {
      type: "divider" as const,
      style: { borderColor: "#d0d0d0", borderWidth: 0.5, margin: "8px 0" },
    },
    {
      key: "task_header",
      type: "group" as const,
      label: (
        <span
          style={{
            fontSize: 12,
            color: "#555",
            fontWeight: 600,
            letterSpacing: 1,
          }}
        >
          按任务筛选
        </span>
      ),
      children: taskItems,
    },
  ];

  return (
    <div style={{ overflowY: "auto", height: "100%" }}>
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        defaultOpenKeys={["status_group"]}
        onSelect={handleSelect}
        items={allMenuItems}
        style={{ borderRight: "none" }}
      />
    </div>
  );
}

// ────────── 主页面 ──────────
export default function PlotsOverview() {
  const {
    search,
    status_filter,
    platform_id,
    task_id,
    page,
    page_size,
    setSearch,
    setPage,
  } = useFilterStore();

  const [inputValue, setInputValue] = useState(search);
  const debouncedSearch = useDebounce(inputValue, 300);
  const prevDebounced = useRef(debouncedSearch);

  // 弹窗状态
  const [drawerPlotId, setDrawerPlotId] = useState<string | null>(null);
  const [modalPlotTaskId, setModalPlotTaskId] = useState<number | null>(null);

  useEffect(() => {
    if (debouncedSearch !== prevDebounced.current) {
      prevDebounced.current = debouncedSearch;
      setSearch(debouncedSearch);
    }
  }, [debouncedSearch, setSearch]);

  const filter = {
    page,
    page_size,
    search,
    status_filter,
    platform_id,
    task_id,
  };

  const [wizardOpen, setWizardOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const {
    data: pageData,
    isLoading,
    isError,
    error,
    refetch: refetchPlots,
  } = useQuery({
    queryKey: ["plots", filter],
    queryFn: () => fetchPlots(filter),
  });

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["plots-stats"],
    queryFn: fetchPlotsStats,
    staleTime: 30_000,
  });

  function handleImportSuccess() {
    void refetchPlots();
    void refetchStats();
  }

  function handleClearAll() {
    Modal.confirm({
      title: "确认清空所有数据？",
      content: "此操作将删除所有图斑及关联任务，无法恢复，请谨慎操作。",
      okText: "确认清空",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        try {
          const result = await clearAllPlots();
          void message.success(`已清空 ${result.deleted} 条图斑数据`);
          void refetchPlots();
          void refetchStats();
        } catch (e) {
          void message.error(`清空失败：${(e as Error).message}`);
        }
      },
    });
  }

  const columns: ColumnsType<PlotWithTaskSummary> = [
    {
      title: "监测编号",
      dataIndex: "plot_id",
      key: "plot_id",
      width: 160,
      ellipsis: true,
    },
    { title: "乡镇名称", dataIndex: "township", key: "township", width: 100 },
    { title: "村名称", dataIndex: "village", key: "village", width: 100 },
    {
      title: "监测面积",
      dataIndex: "area",
      key: "area",
      width: 90,
      render: (v: number | null) => (v != null ? v.toFixed(2) : "—"),
    },
    {
      title: "耕地面积",
      dataIndex: "farmland_area",
      key: "farmland_area",
      width: 90,
      render: (v: number | null) => (v != null ? v.toFixed(2) : "—"),
    },
    {
      title: "占基本农田面积",
      dataIndex: "basic_farmland",
      key: "basic_farmland",
      width: 120,
      render: (v: number | null) => (v != null ? v.toFixed(2) : "—"),
    },
    {
      title: "任务数量",
      dataIndex: "task_count",
      key: "task_count",
      width: 80,
    },
    {
      title: "处理状态",
      key: "process_status",
      width: 140,
      render: (_: unknown, record: PlotWithTaskSummary) => (
        <ProcessStatusCell tasks={record.tasks} />
      ),
    },
    {
      title: "查看",
      key: "actions",
      width: 80,
      render: (_: unknown, record: PlotWithTaskSummary) => (
        <Button
          size="small"
          type="link"
          onClick={() => setDrawerPlotId(record.plot_id)}
        >
          详情
        </Button>
      ),
    },
  ];

  const expandable: ExpandableConfig<PlotWithTaskSummary> = {
    expandedRowRender: (record) => (
      <TaskSubTable
        tasks={record.tasks}
        onTaskDetail={(id) => setModalPlotTaskId(id)}
      />
    ),
    rowExpandable: (record) => record.task_count > 0,
  };

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
    },
    [],
  );

  // 动态计算表格体可用高度
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const [tableScrollY, setTableScrollY] = useState<number>(400);

  useLayoutEffect(() => {
    const calcHeight = () => {
      const wrapper = tableWrapRef.current;
      if (!wrapper) return;
      // 找到实际的 .ant-table-body 来计算可用高度
      const tableHeader =
        wrapper.querySelector<HTMLElement>(".ant-table-thead");
      const pagination = wrapper.querySelector<HTMLElement>(
        ".ant-table-pagination",
      );
      const headerH = tableHeader?.offsetHeight ?? 40;
      const paginationH = pagination?.offsetHeight ?? 32;
      // 容器总高度 - 表头 - 分页 - 额外间距
      const h = wrapper.clientHeight - headerH - paginationH - 24;
      setTableScrollY(Math.max(h, 200));
    };
    // 延迟计算，等 DOM 渲染完毕
    const timer = setTimeout(calcHeight, 100);
    const ro = new ResizeObserver(() => {
      calcHeight();
    });
    if (tableWrapRef.current) ro.observe(tableWrapRef.current);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, []);

  return (
    <Row style={{ height: "100%", overflow: "hidden" }}>
      {/* 左侧筛选面板 */}
      <Col
        flex="200px"
        style={{
          borderRight: "1px solid #f0f0f0",
          padding: "0 0",
          height: "100%",
          overflow: "auto",
          flexShrink: 0,
        }}
      >
        <FilterPanel stats={stats} />
      </Col>

      {/* 右侧主内容 */}
      <Col flex="1" style={{ minWidth: 0, height: "100%", overflow: "hidden" }}>
        <div
          style={{
            padding: 16,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
          }}
        >
          {/* 搜索栏 */}
          <div
            style={{ marginBottom: 12, display: "flex", gap: 8, flexShrink: 0 }}
          >
            <Input.Search
              placeholder="按监测编号、乡镇、村名搜索..."
              allowClear
              value={inputValue}
              onChange={handleSearchChange}
              style={{ width: 360 }}
            />
            <Button
              icon={<UploadOutlined />}
              onClick={() => setWizardOpen(true)}
            >
              导入 Excel
            </Button>
            <Button
              icon={<ExportOutlined />}
              onClick={() => setExportOpen(true)}
            >
              导出
            </Button>
            <Button icon={<DeleteOutlined />} danger onClick={handleClearAll}>
              清空数据
            </Button>
          </div>

          {isError && (
            <Alert
              type="error"
              message={`加载失败：${(error as Error).message}`}
              style={{ marginBottom: 12 }}
            />
          )}

          <div
            ref={tableWrapRef}
            style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
          >
            <Table<PlotWithTaskSummary>
              className="plots-table-fill"
              columns={columns}
              dataSource={pageData?.items ?? []}
              rowKey="plot_id"
              expandable={expandable}
              loading={isLoading}
              size="middle"
              pagination={{
                current: page,
                pageSize: page_size,
                total: pageData?.total ?? 0,
                showSizeChanger: false,
                showTotal: (t) => `共 ${t} 条`,
                onChange: (p) => setPage(p),
              }}
              scroll={{ x: "max-content", y: tableScrollY }}
            />
          </div>
        </div>
      </Col>

      <ImportWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={handleImportSuccess}
      />

      <PlotDetailDrawer
        open={drawerPlotId != null}
        plotId={drawerPlotId}
        onClose={() => setDrawerPlotId(null)}
        onSaved={() => {
          void refetchPlots();
          void refetchStats();
        }}
      />

      <PlotTaskDetailModal
        open={modalPlotTaskId != null}
        plotTaskId={modalPlotTaskId}
        onClose={() => setModalPlotTaskId(null)}
        onSaved={() => {
          void refetchPlots();
          void refetchStats();
        }}
      />

      <ExportPanel open={exportOpen} onClose={() => setExportOpen(false)} />
    </Row>
  );
}
