import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Layout, Menu } from "antd";
import type { MenuProps } from "antd";
import PlotsOverview from "./pages/PlotsOverview";
import TaskManagement from "./pages/TaskManagement";
import Settings from "./pages/Settings";

const { Sider, Content } = Layout;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
    },
  },
});

const NAV_ITEMS: MenuProps["items"] = [
  { key: "/", label: "📋 图斑总览" },
  { key: "/tasks", label: "📥 任务管理" },
  { key: "/settings", label: "⚙️ 系统配置" },
];

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Layout style={{ height: "100vh" }}>
      <Sider
        width={180}
        theme="light"
        style={{ borderRight: "1px solid #f0f0f0" }}
      >
        <div
          style={{
            height: 48,
            display: "flex",
            alignItems: "center",
            paddingLeft: 16,
            fontWeight: 600,
            fontSize: 15,
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          图斑管理平台
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={NAV_ITEMS}
          style={{ borderRight: "none" }}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Content style={{ overflow: "hidden", height: "100%" }}>
          <Routes>
            <Route path="/" element={<PlotsOverview />} />
            <Route path="/tasks" element={<TaskManagement />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
