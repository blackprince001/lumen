"""Multi-paper chat API endpoints (group and selection-based)."""

import json
from typing import List, cast

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.crud.multi_chat_session import (
  delete_multi_chat_session,
  get_multi_chat_session_or_404,
  list_multi_chat_sessions_for_group,
)
from app.core.logger import get_logger
from app.dependencies import get_db
from app.models.multi_chat import MultiChatMessage, MultiChatSession
from app.schemas.multi_chat import (
  MultiChatRequest,
  MultiChatSessionCreate,
  MultiChatSessionUpdate,
)
from app.schemas.multi_chat import (
  MultiChatSession as MultiChatSessionSchema,
)
from app.services.multi_chat import multi_chat_service

logger = get_logger(__name__)

router = APIRouter()


# ---- Helper to serialize a session ----


def _serialize_session(session: MultiChatSession) -> dict:
  """Convert a MultiChatSession ORM object to a response dict."""
  return {
    "id": session.id,
    "name": session.name,
    "group_id": session.group_id,
    "paper_ids": [p.id for p in session.papers] if session.papers else [],
    "papers": [
      {
        "id": p.id,
        "title": p.title,
        "has_file": bool(p.file_path),
      }
      for p in session.papers
    ]
    if session.papers
    else [],
    "messages": [
      {
        "id": m.id,
        "session_id": m.session_id,
        "parent_message_id": m.parent_message_id,
        "role": m.role,
        "content": m.content,
        "references": m.references or {},
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "thread_count": 0,
      }
      for m in (session.messages or [])
    ],
    "created_at": session.created_at.isoformat() if session.created_at else None,
    "updated_at": session.updated_at.isoformat() if session.updated_at else None,
  }


# ============================================================
# Group-scoped endpoints
# ============================================================


@router.post("/groups/{group_id}/chat/stream")
async def stream_group_chat_message(
  group_id: int,
  chat_request: MultiChatRequest,
  session: AsyncSession = Depends(get_db),
):
  """Stream a chat message with all papers in a group as context."""

  async def generate_stream():
    async for chunk in multi_chat_service.stream_message(
      db_session=session,
      user_message=chat_request.message,
      group_id=group_id,
      references=chat_request.references,
      session_id=chat_request.session_id,
    ):
      yield f"data: {json.dumps(chunk)}\n\n"

  return StreamingResponse(
    generate_stream(),
    media_type="text/event-stream",
    headers={
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  )


@router.get("/groups/{group_id}/chat")
async def get_group_chat_history(
  group_id: int,
  session: AsyncSession = Depends(get_db),
):
  """Get the latest multi-chat session for a group."""
  latest = await multi_chat_service.get_latest_session(session, group_id)
  if not latest:
    return None
  return _serialize_session(latest)


@router.get(
  "/groups/{group_id}/multi-sessions", response_model=List[MultiChatSessionSchema]
)
async def list_group_sessions(
  group_id: int,
  session: AsyncSession = Depends(get_db),
):
  """List all multi-chat sessions for a group."""
  sessions = await list_multi_chat_sessions_for_group(session, group_id)
  return [_serialize_session(s) for s in sessions]


@router.post(
  "/groups/{group_id}/multi-sessions",
  response_model=MultiChatSessionSchema,
  status_code=201,
)
async def create_group_session(
  group_id: int,
  session_data: MultiChatSessionCreate,
  session: AsyncSession = Depends(get_db),
):
  """Create a new multi-chat session for a group."""
  # Get paper IDs from the group
  paper_ids = session_data.paper_ids
  if not paper_ids:
    paper_ids = await multi_chat_service._fetch_group_paper_ids(session, group_id)

  if not paper_ids:
    raise HTTPException(
      status_code=400,
      detail="Group has no papers. Add papers to the group first.",
    )

  try:
    chat_session = await multi_chat_service.create_session(
      session, paper_ids, group_id=group_id, name=session_data.name
    )
    # Reload with relationships
    loaded = await multi_chat_service.get_session(session, cast(int, chat_session.id))
    if not loaded:
      raise HTTPException(status_code=500, detail="Failed to load created session")
    return _serialize_session(loaded)
  except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))


# ============================================================
# Ad-hoc multi-paper chat (arbitrary paper selection)
# ============================================================


@router.post("/multi-chat/stream")
async def stream_multi_chat_message(
  chat_request: MultiChatRequest,
  session: AsyncSession = Depends(get_db),
):
  """Stream a chat message with arbitrary papers as context."""
  if not chat_request.paper_ids and not chat_request.group_id:
    raise HTTPException(
      status_code=400,
      detail="Either paper_ids or group_id must be provided.",
    )

  async def generate_stream():
    async for chunk in multi_chat_service.stream_message(
      db_session=session,
      user_message=chat_request.message,
      paper_ids=chat_request.paper_ids,
      group_id=chat_request.group_id,
      references=chat_request.references,
      session_id=chat_request.session_id,
    ):
      yield f"data: {json.dumps(chunk)}\n\n"

  return StreamingResponse(
    generate_stream(),
    media_type="text/event-stream",
    headers={
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  )


# ============================================================
# Session-level endpoints (shared between group and ad-hoc)
# ============================================================


@router.get("/multi-chat/sessions/{session_id}", response_model=MultiChatSessionSchema)
async def get_multi_session(
  session_id: int,
  session: AsyncSession = Depends(get_db),
):
  """Get a specific multi-chat session."""
  chat_session = await get_multi_chat_session_or_404(
    session, session_id, with_messages=True, with_papers=True
  )
  return _serialize_session(chat_session)


@router.patch(
  "/multi-chat/sessions/{session_id}", response_model=MultiChatSessionSchema
)
async def update_multi_session(
  session_id: int,
  session_update: MultiChatSessionUpdate,
  session: AsyncSession = Depends(get_db),
):
  """Update a multi-chat session (rename)."""
  chat_session = await get_multi_chat_session_or_404(
    session, session_id, with_messages=True, with_papers=True
  )
  chat_session.name = session_update.name
  await session.commit()
  await session.refresh(chat_session)
  return _serialize_session(chat_session)


@router.delete("/multi-chat/sessions/{session_id}", status_code=204)
async def delete_multi_session(
  session_id: int,
  session: AsyncSession = Depends(get_db),
):
  """Delete a multi-chat session and all its messages."""
  await delete_multi_chat_session(session, session_id)
  return None


@router.delete("/multi-chat/sessions/{session_id}/messages", status_code=204)
async def clear_multi_session_messages(
  session_id: int,
  session: AsyncSession = Depends(get_db),
):
  """Clear all messages from a multi-chat session."""
  chat_session = await get_multi_chat_session_or_404(
    session, session_id, with_messages=True
  )
  stmt = delete(MultiChatMessage).where(MultiChatMessage.session_id == chat_session.id)
  await session.execute(stmt)
  await session.commit()
  return None
