import re

from pydantic import BaseModel
from pydantic import Field, field_validator
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


class OrderItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)


class RestaurantOrderCreate(BaseModel):
    delivery_address: str = Field(min_length=1, max_length=500)
    customer_phone: str = Field(min_length=7, max_length=32)
    car_required: bool = False
    items: list[OrderItemCreate] = Field(min_length=1)

    @field_validator("delivery_address")
    @classmethod
    def validate_delivery_address(cls, value: str) -> str:
        address = value.strip()
        if not address:
            raise ValueError("Delivery address cannot be empty.")
        return address

    @field_validator("customer_phone")
    @classmethod
    def validate_customer_phone(cls, value: str) -> str:
        phone = value.strip()
        digits = re.sub(r"\D", "", phone)
        if (
            not re.fullmatch(r"\+?[0-9\s().-]+", phone)
            or not 7 <= len(digits) <= 15
        ):
            raise ValueError("Enter a valid phone number with 7 to 15 digits.")
        return phone
