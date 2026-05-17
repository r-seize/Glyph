import json
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.schemas.user import UserOut


class CodeReferenceBase(BaseModel):
    line_start: int          = Field(..., ge=1)
    line_end: int            = Field(..., ge=1)
    label: str | None        = Field(None, max_length=120)
    note: str | None         = None
    color: str | None        = Field(None, max_length=20)
    lines: list[int] | None  = None


class CodeReferenceCreate(CodeReferenceBase):
    file_path: str
    commit_sha: str
    line_start: int  = Field(1, ge=1)
    line_end: int    = Field(1, ge=1)


class CodeReferenceUpdate(BaseModel):
    line_start: int | None   = Field(None, ge=1)
    line_end: int | None     = Field(None, ge=1)
    label: str | None        = Field(None, max_length=120)
    note: str | None         = None
    color: str | None        = Field(None, max_length=20)
    lines: list[int] | None  = None


class CodeReferenceOut(CodeReferenceBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    file_path: str
    commit_sha: str
    author: UserOut | None = None
    created_at: datetime
    updated_at: datetime
    lines: list[int] | None = None

    @model_validator(mode='before')
    @classmethod
    def parse_lines(cls, data):
        # data is a SQLAlchemy ORM object when from_attributes=True
        if hasattr(data, 'lines') and isinstance(getattr(data, 'lines'), str):
            try:
                data.__dict__['lines'] = json.loads(data.lines)
            except Exception:
                data.__dict__['lines'] = None
        return data
