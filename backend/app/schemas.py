from pydantic import BaseModel
from pydantic import Field
from typing import Literal


class RiderStatus(BaseModel):
    online: bool


class LoginCredentials(BaseModel):
    username: str
    password: str


class RegistrationCredentials(BaseModel):
    username: str
    password: str = Field(min_length=8)
    role: Literal["rider", "restaurant"]


class ProductCreate(BaseModel):
    name: str
    description: str | None = None
    price: float
    category_id: int
    stock: int
