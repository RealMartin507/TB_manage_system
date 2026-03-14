import os
import sys
import socket
import time
from pathlib import Path
from threading import Thread

import uvicorn
import webview
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# 导入路由
sys.path.insert(0, str(Path(__file__).parent.parent))
from app.db.connection import init_db
from app.routers import health, plots, tasks, plot_tasks, platforms, import_templates, export_templates, import_data, export

# ============ FastAPI 应用配置 ============
app = FastAPI(title="图斑任务管理平台")

# CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化数据库（执行迁移）
init_db()

# 注册路由
app.include_router(health.router, prefix="/api/v1")
app.include_router(plots.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(plot_tasks.router, prefix="/api/v1")
app.include_router(platforms.router, prefix="/api/v1")
app.include_router(import_templates.router, prefix="/api/v1")
app.include_router(export_templates.router, prefix="/api/v1")
app.include_router(import_data.router, prefix="/api/v1")
app.include_router(export.router, prefix="/api/v1")

# ============ pywebview 配置 ============
APP_ENV = os.getenv("APP_ENV", "dev")
VITE_DEV_URL = "http://localhost:5173"
DIST_PATH = Path(__file__).parent.parent / "dist"


def start_backend() -> None:
    """在线程中启动 FastAPI 后端"""
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
    )


def check_dev_server_ready(max_retries: int = 30) -> bool:
    """检查 Vite dev server 是否已启动"""
    for i in range(max_retries):
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex(("127.0.0.1", 5173))
            sock.close()
            if result == 0:
                print(f"✓ Vite dev server 已就绪")
                return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


def get_window_url() -> str:
    """根据环境返回窗口加载的 URL"""
    if APP_ENV == "dev":
        if check_dev_server_ready():
            return VITE_DEV_URL
        else:
            print("⚠ Vite dev server 未启动，请先运行：npm run dev")
            return VITE_DEV_URL
    else:
        # 生产模式：加载静态文件
        if DIST_PATH.exists():
            return f"file://{DIST_PATH}/index.html"
        else:
            raise FileNotFoundError(f"dist/index.html 不存在，请先运行：npm run build")


def main() -> None:
    """主函数：启动后端 + pywebview 窗口"""
    # 启动后端服务
    backend_thread = Thread(target=start_backend, daemon=True)
    backend_thread.start()

    # 等待后端就绪
    print("等待后端启动...")
    time.sleep(2)

    # 创建 pywebview 窗口
    url = get_window_url()
    print(f"加载 URL: {url}")

    webview.create_window(
        title="图斑任务管理平台",
        url=url,
        width=1280,
        height=800,
    )
    webview.start()


if __name__ == "__main__":
    main()
