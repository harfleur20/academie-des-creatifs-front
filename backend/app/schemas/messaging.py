from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


MessageSenderType = Literal["user", "system"]
MessageThreadType = Literal["direct", "support", "system"]


class MessageUserView(BaseModel):
    id: int
    full_name: str
    role: str
    avatar_url: str | None = None
    avatar_initials: str


class MessageView(BaseModel):
    id: int
    thread_id: int
    sender_user_id: int | None
    sender_type: MessageSenderType
    sender_name: str
    sender_role: str | None = None
    sender_avatar_url: str | None = None
    sender_avatar_initials: str | None = None
    body: str
    created_at: datetime


class MessageThreadView(BaseModel):
    id: int
    subject: str
    thread_type: MessageThreadType
    participants: list[MessageUserView]
    last_message: MessageView | None = None
    unread_count: int
    last_message_at: datetime | None = None
    updated_at: datetime


class MessageThreadDetail(MessageThreadView):
    messages: list[MessageView]


class CreateThreadPayload(BaseModel):
    participant_ids: list[int] = Field(min_length=1, max_length=8)
    subject: str = Field(default="", max_length=255)
    body: str = Field(min_length=1, max_length=5000)


class CreateMessagePayload(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class MessagingSummary(BaseModel):
    unread_count: int
