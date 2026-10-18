from pydantic import BaseModel


class RiderStatus(BaseModel):
    online: bool


class LoginCredentials(BaseModel):
    username: str
    password: str


class ProductCreate(BaseModel):
    name: str
    description: str | None = None
    price: float
