from pydantic import BaseModel
from pydantic import Field, field_validator
from typing import Literal


class RiderStatus(BaseModel):
    online: bool


class RiderLocation(BaseModel):
    latitude: float
    longitude: float


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


class OrderItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)


class RestaurantOrderCreate(BaseModel):
    delivery_address: str = Field(min_length=1, max_length=500)
    car_required: bool = False
    items: list[OrderItemCreate] = Field(min_length=1)

    @field_validator("delivery_address")
    @classmethod
    def validate_delivery_address(cls, value: str) -> str:
        address = value.strip()
        if not address:
            raise ValueError("Delivery address cannot be empty.")
        return address
