from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import RoleEnum


class UserBase(BaseModel):
    nome: str = Field(min_length=2, max_length=150)
    email: str = Field(min_length=3, max_length=255)
    role: RoleEnum


class UserCreate(UserBase):
    senha: str = Field(min_length=6, max_length=128)


class UserUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=150)
    email: str | None = Field(default=None, min_length=3, max_length=255)
    role: RoleEnum | None = None
    senha: str | None = Field(default=None, min_length=6, max_length=128)


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
