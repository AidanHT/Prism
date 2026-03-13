"""Modules microservice router.

Handles course module CRUD and module-item position reordering.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_current_user, get_db
from app.models.course import Course, Module, ModuleItem
from app.models.user import User
from app.schemas.base import AppBaseModel
from app.schemas.courses import (
    ModuleCreate,
    ModuleItemCreate,
    ModuleItemResponse,
    ModuleItemUpdate,
    ModuleResponse,
    ModuleUpdate,
)

router = APIRouter(tags=["modules"])


# ── Local schema for reorder ──────────────────────────────────────────────────

class ReorderItem(AppBaseModel):
    id: UUID
    position: int = Field(..., ge=0)


class ReorderRequest(AppBaseModel):
    items: list[ReorderItem] = Field(..., min_length=1)


# ── Module CRUD ───────────────────────────────────────────────────────────────

@router.get("/courses/{course_id}/modules", response_model=list[ModuleResponse])
async def list_modules(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Module]:
    """List all modules for a course, ordered by position."""
    course_row = await db.execute(select(Course).where(Course.id == course_id))
    if course_row.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")
    result = await db.execute(
        select(Module)
        .where(Module.course_id == course_id)
        .order_by(Module.position)
        .options(selectinload(Module.items))
    )
    return list(result.scalars().all())


@router.post(
    "/courses/{course_id}/modules",
    response_model=ModuleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_module(
    course_id: UUID,
    payload: ModuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Module:
    """Create a new module in a course."""
    course_row = await db.execute(select(Course).where(Course.id == course_id))
    if course_row.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")
    module = Module(**payload.model_dump())
    db.add(module)
    await db.flush()
    await db.refresh(module)
    return module


@router.get("/modules/{module_id}", response_model=ModuleResponse)
async def get_module(
    module_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Module:
    """Retrieve a module with its items, ordered by position."""
    result = await db.execute(
        select(Module)
        .where(Module.id == module_id)
        .options(selectinload(Module.items))
    )
    module = result.scalar_one_or_none()
    if module is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found.")
    return module


@router.put("/modules/{module_id}", response_model=ModuleResponse)
async def update_module(
    module_id: UUID,
    payload: ModuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Module:
    """Update mutable fields on a module."""
    result = await db.execute(select(Module).where(Module.id == module_id))
    module = result.scalar_one_or_none()
    if module is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(module, field, value)
    await db.flush()
    await db.refresh(module)
    return module


@router.delete("/modules/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_module(
    module_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a module and all its items."""
    result = await db.execute(select(Module).where(Module.id == module_id))
    module = result.scalar_one_or_none()
    if module is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found.")
    await db.delete(module)


# ── Reorder ───────────────────────────────────────────────────────────────────

@router.patch("/modules/{module_id}/reorder", response_model=ModuleResponse)
async def reorder_module_items(
    module_id: UUID,
    payload: ReorderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Module:
    """
    Batch-update the ``position`` field of module items in a single transaction.

    Accepts a list of ``{id, position}`` objects; only items belonging to the
    specified module are updated.  Unknown IDs are silently ignored.
    """
    result = await db.execute(
        select(Module)
        .where(Module.id == module_id)
        .options(selectinload(Module.items))
    )
    module = result.scalar_one_or_none()
    if module is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found.")

    # Build a lookup of item_id → new position from the request.
    position_map: dict[UUID, int] = {entry.id: entry.position for entry in payload.items}

    # Fetch only the relevant module items in one query.
    item_result = await db.execute(
        select(ModuleItem).where(
            ModuleItem.module_id == module_id,
            ModuleItem.id.in_(list(position_map.keys())),
        )
    )
    items = item_result.scalars().all()

    for item in items:
        item.position = position_map[item.id]

    await db.flush()
    # Refresh the module so the response reflects the new ordering.
    await db.refresh(module)
    return module


# ── Module item management ────────────────────────────────────────────────────

@router.post(
    "/modules/{module_id}/items",
    response_model=ModuleItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_module_item(
    module_id: UUID,
    payload: ModuleItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ModuleItem:
    """Add a content item reference to a module."""
    module_row = await db.execute(select(Module).where(Module.id == module_id))
    if module_row.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found.")
    item = ModuleItem(**payload.model_dump())
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


@router.put("/module-items/{item_id}", response_model=ModuleItemResponse)
async def update_module_item(
    item_id: UUID,
    payload: ModuleItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ModuleItem:
    """Update a module item reference."""
    result = await db.execute(select(ModuleItem).where(ModuleItem.id == item_id))
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module item not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await db.flush()
    await db.refresh(item)
    return item


@router.delete("/module-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_module_item(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Remove an item from a module."""
    result = await db.execute(select(ModuleItem).where(ModuleItem.id == item_id))
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module item not found.")
    await db.delete(item)
