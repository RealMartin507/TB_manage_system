"""导入向导路由 - upload / preview / execute"""
from __future__ import annotations

import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile

from app.db.connection import get_db
from app.schemas import (
    ExecuteImportRequest,
    ImportResult,
    PreviewRequest,
    PreviewResult,
    UploadResult,
)
from app.services import import_service

router = APIRouter(prefix="/import", tags=["import"])

DB = Annotated[sqlite3.Connection, Depends(get_db)]


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    上传 Excel 文件，解析所有 Sheet 信息。
    返回 session_id 供后续步骤使用。
    """
    try:
        content = await file.read()
        result = import_service.save_upload(content, file.filename or "upload.xlsx")
        return {"success": True, "data": UploadResult(**result).model_dump()}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/preview")
def preview_sheet(body: PreviewRequest):
    """
    预览指定 Sheet 的表头和前 5 行数据。
    """
    try:
        result = import_service.preview_sheet(
            body.session_id,
            body.sheet_name,
            body.header_row,
        )
        return {"success": True, "data": PreviewResult(**result).model_dump()}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/execute")
def execute_import(body: ExecuteImportRequest, db: DB):
    """
    执行批量导入：按 mapping 将 Excel 数据写入数据库。
    """
    try:
        result = import_service.execute_import(
            db,
            session_id=body.session_id,
            sheet_name=body.sheet_name,
            header_row=body.header_row,
            data_start_row=body.data_start_row,
            data_end_row=body.data_end_row,
            source=body.source,
            task_name=body.task_name,
            platform_id=body.platform_id,
            mapping=body.mapping,
        )
        return {"success": True, "data": ImportResult(**result).model_dump()}
    except Exception as e:
        return {"success": False, "error": str(e)}
