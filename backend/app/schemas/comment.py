from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.schemas.user import UserOut


class CommentCreate(BaseModel):
    content: str
    line_number: Optional[int] = None


class CommentUpdate(BaseModel):
    content: str


class CommentOut(BaseModel):
    id: str
    document_id: str
    author: UserOut
    content: str
    line_number: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}