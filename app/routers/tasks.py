"""任务路由"""
import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.db.connection import get_db
from app.schemas import TaskCreate, TaskUpdate
from app.services import task_service

router = APIRouter(prefix="/tasks", tags=["tasks"])

DB = Annotated[sqlite3.Connection, Depends(get_db)]


@router.get("")
def list_tasks(db: DB):
    try:
        return {"success": True, "data": task_service.get_tasks(db)}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/{task_id}")
def get_task(task_id: int, db: DB):
    try:
        task = task_service.get_task(db, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="任务不存在")
        return {"success": True, "data": task}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("")
def create_task(body: TaskCreate, db: DB):
    try:
        result = task_service.create_task(db, body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.put("/{task_id}")
def update_task(task_id: int, body: TaskUpdate, db: DB):
    try:
        result = task_service.update_task(db, task_id, body)
        if result is None:
            raise HTTPException(status_code=404, detail="任务不存在")
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.delete("/{task_id}")
def delete_task(task_id: int, db: DB):
    try:
        ok = task_service.delete_task(db, task_id)
        if not ok:
            raise HTTPException(status_code=404, detail="任务不存在")
        return {"success": True, "data": None}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e)}
