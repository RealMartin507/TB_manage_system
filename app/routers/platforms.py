"""填报平台配置路由"""
import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.db.connection import get_db
from app.schemas import PlatformCreate, PlatformUpdate
from app.services import platform_service

router = APIRouter(prefix="/platforms", tags=["platforms"])

DB = Annotated[sqlite3.Connection, Depends(get_db)]


@router.get("")
def list_platforms(db: DB):
    try:
        return {"success": True, "data": platform_service.get_platforms(db)}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("")
def create_platform(body: PlatformCreate, db: DB):
    try:
        result = platform_service.create_platform(db, body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.put("/{platform_id}")
def update_platform(platform_id: int, body: PlatformUpdate, db: DB):
    try:
        result = platform_service.update_platform(db, platform_id, body)
        if result is None:
            raise HTTPException(status_code=404, detail="平台不存在")
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.delete("/{platform_id}")
def delete_platform(platform_id: int, db: DB):
    try:
        ok = platform_service.delete_platform(db, platform_id)
        if not ok:
            raise HTTPException(status_code=404, detail="平台不存在")
        return {"success": True, "data": None}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e)}
