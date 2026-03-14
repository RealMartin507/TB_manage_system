"""导出路由"""
import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.db.connection import get_db
from app.schemas import ExportExecuteRequest, ExportExecuteResult
from app.services import export_service

router = APIRouter(prefix="/export", tags=["export"])

DB = Annotated[sqlite3.Connection, Depends(get_db)]


@router.post("/execute")
def execute_export(body: ExportExecuteRequest, db: DB):
    if not body.task_ids:
        return {"success": False, "error": "task_ids 不能为空"}
    if not body.fields:
        return {"success": False, "error": "fields 不能为空"}
    try:
        result = export_service.execute_export(db, body.task_ids, body.fields)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/download/{download_token}")
def download_export(download_token: str):
    try:
        file_path = export_service.get_export_file(download_token)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # FileResponse 发送完成后删除临时文件
    response = FileResponse(
        path=str(file_path),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=file_path.name,
        background=None,
    )

    # 注册后台清理（利用 starlette BackgroundTask）
    from starlette.background import BackgroundTask
    response.background = BackgroundTask(export_service.delete_export_file, download_token)
    return response
