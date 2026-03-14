from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/health", tags=["health"])


class HealthResponse(BaseModel):
    """健康检查响应"""
    success: bool
    data: str


@router.get("", response_model=HealthResponse)
def health_check() -> HealthResponse:
    """
    健康检查接口
    返回 { success: true, data: "ok" }
    """
    return HealthResponse(success=True, data="ok")
