"""导入映射模板路由"""
import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.db.connection import get_db
from app.schemas import ImportTemplateCreate, ImportTemplateUpdate
from app.services import template_service

router = APIRouter(prefix="/import-templates", tags=["import-templates"])

DB = Annotated[sqlite3.Connection, Depends(get_db)]


@router.get("")
def list_import_templates(db: DB):
    try:
        return {"success": True, "data": template_service.get_import_templates(db)}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("")
def create_import_template(body: ImportTemplateCreate, db: DB):
    try:
        result = template_service.create_import_template(db, body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.put("/{template_id}")
def update_import_template(template_id: int, body: ImportTemplateUpdate, db: DB):
    try:
        result = template_service.update_import_template(db, template_id, body)
        if result is None:
            raise HTTPException(status_code=404, detail="模板不存在")
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.delete("/{template_id}")
def delete_import_template(template_id: int, db: DB):
    try:
        ok = template_service.delete_import_template(db, template_id)
        if not ok:
            raise HTTPException(status_code=404, detail="模板不存在")
        return {"success": True, "data": None}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e)}
