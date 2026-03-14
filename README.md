# 图斑任务管理平台

本地桌面 Web 应用，采用 pywebview + React + FastAPI 架构。

## 项目结构

```
tb-manager/
├── app/
│   ├── main.py              ← 入口：启动 FastAPI + pywebview
│   ├── db/
│   │   └── connection.py    ← SQLite 连接
│   └── routers/
│       └── health.py        ← 健康检查接口
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   └── index.css
├── public/
│   └── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── requirements.txt
└── README.md
```

## 开发流程

### 1. 环境准备

```bash
# 安装 Python 依赖
pip install -r requirements.txt

# 安装 Node 依赖
npm install
```

### 2. 启动开发服务（分别在两个终端）

#### 终端 1 - 启动前端开发服务器

```bash
npm run dev
```

输出示例：
```
VITE v5.0.0  ready in 123 ms

➜  Local:   http://localhost:5173/
```

#### 终端 2 - 启动后端 + pywebview 窗口

```bash
# 开发模式（加载 Vite dev server）
set APP_ENV=dev
python app/main.py
```

或者在 Linux/macOS 上：
```bash
APP_ENV=dev python app/main.py
```

pywebview 窗口将自动打开，加载 http://localhost:5173，页面会调用后端接口 `/api/v1/health` 验证通信。

### 3. 验证步骤

1. **检查前端页面** - pywebview 窗口应显示"前后端通信成功"的绿色提示
2. **查看返回数据** - 页面应显示 `{ success: true, data: "ok" }`
3. **测试刷新按钮** - 点击"刷新"按钮，再次调用接口

### 4. 生产构建

```bash
# 构建前端
npm run build

# 生产模式运行（加载 dist/index.html）
set APP_ENV=prod
python app/main.py
```

## API 端点

### 健康检查

```http
GET /api/v1/health
```

响应：
```json
{
  "success": true,
  "data": "ok"
}
```

## 数据库

- 类型：SQLite 3
- 文件位置：`app/db/tb_manager.db`
- 连接函数：`app.db.connection.get_db()`

## 技术栈

| 层级 | 技术 |
|-----|------|
| 桌面框架 | pywebview 5.1 |
| 前端框架 | React 18 + TypeScript |
| UI 库 | Ant Design 5 |
| 状态管理 | Zustand |
| 数据获取 | @tanstack/react-query |
| 构建工具 | Vite 5 |
| HTTP 客户端 | Axios |
| 后端框架 | FastAPI |
| Web 服务器 | Uvicorn |
| 数据库 | SQLite 3 |

## 常见问题

### 启动时提示"Vite dev server 未启动"

请确保已在另一个终端运行 `npm run dev`。

### 前端加载失败

1. 检查后端是否正常启动（应听取 http://127.0.0.1:8000）
2. 检查 CORS 中间件配置（允许所有来源）
3. 查看浏览器开发者工具的 Network 标签

### 修改代码后不生效

确保使用开发模式（`APP_ENV=dev`）。生产模式需要重新 build。
