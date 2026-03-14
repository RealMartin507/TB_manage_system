"""图斑路由"""
import sqlite3
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.db.connection import get_db
from app.schemas import PlotCreate, PlotUpdate
from app.services import plot_service, plot_task_service

router = APIRouter(prefix="/plots", tags=["plots"])

DB = Annotated[sqlite3.Connection, Depends(get_db)]


@router.get("/stats")
def get_plots_stats(db: DB):
    try:
        result = plot_service.get_plots_stats(db)
        return {"success": True, "data": result.model_dump()}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("")
def list_plots(
    db: DB,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    search: str = Query(""),
    status_filter: str = Query(""),
    platform_id: int = Query(0),
    task_id: int = Query(0),
):
    try:
        result = plot_service.get_plots_overview(
            db,
            page=page,
            page_size=page_size,
            search=search,
            status_filter=status_filter,
            platform_id=platform_id,
            task_id=task_id,
        )
        return {"success": True, "data": result.model_dump()}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/{plot_id}")
def get_plot(plot_id: str, db: DB):
    try:
        plot = plot_service.get_plot_detail(db, plot_id)
        if plot is None:
            raise HTTPException(status_code=404, detail="图斑不存在")
        return {"success": True, "data": plot.model_dump()}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("")
def create_plot(body: PlotCreate, db: DB):
    try:
        result = plot_service.create_plot(db, body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.put("/{plot_id}")
def update_plot(plot_id: str, body: PlotUpdate, db: DB):
    try:
        result = plot_service.update_plot(db, plot_id, body)
        if result is None:
            raise HTTPException(status_code=404, detail="图斑不存在")
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.delete("")
def clear_all_plots(db: DB):
    try:
        count = plot_service.clear_all_plots(db)
        return {"success": True, "data": {"deleted": count}}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.delete("/{plot_id}")
def delete_plot(plot_id: str, db: DB):
    try:
        ok = plot_service.delete_plot(db, plot_id)
        if not ok:
            raise HTTPException(status_code=404, detail="图斑不存在")
        return {"success": True, "data": None}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e)}
