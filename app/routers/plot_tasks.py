"""图斑-任务关联路由"""
import sqlite3
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.db.connection import get_db
from app.schemas import PlotTaskCreate, PlotTaskUpdate
from app.services import plot_task_service

router = APIRouter(prefix="/plot-tasks", tags=["plot-tasks"])

DB = Annotated[sqlite3.Connection, Depends(get_db)]


@router.get("")
def list_plot_tasks(
    db: DB,
    plot_id: Optional[str] = Query(None),
    task_id: Optional[int] = Query(None),
):
    try:
        result = plot_task_service.get_plot_tasks(
            db, plot_id=plot_id, task_id=task_id
        )
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/{record_id}")
def get_plot_task(record_id: int, db: DB):
    try:
        result = plot_task_service.get_plot_task_full(db, record_id)
        if result is None:
            raise HTTPException(status_code=404, detail="关联记录不存在")
        return {"success": True, "data": result.model_dump()}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("")
def create_plot_task(body: PlotTaskCreate, db: DB):
    try:
        result = plot_task_service.create_plot_task(db, body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.put("/{record_id}")
def update_plot_task(record_id: int, body: PlotTaskUpdate, db: DB):
    try:
        result = plot_task_service.update_plot_task(db, record_id, body)
        if result is None:
            raise HTTPException(status_code=404, detail="关联记录不存在")
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.delete("/{record_id}")
def delete_plot_task(record_id: int, db: DB):
    try:
        ok = plot_task_service.delete_plot_task(db, record_id)
        if not ok:
            raise HTTPException(status_code=404, detail="关联记录不存在")
        return {"success": True, "data": None}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e)}
