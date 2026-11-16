import re

from pydantic import BaseModel, model_validator
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


class RestaurantAddressUpdate(BaseModel):
    address: str = Field(min_length=1, max_length=500)
    latitude: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    longitude: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)

    @field_validator("address")
    @classmethod
    def validate_address(cls, value: str) -> str:
        address = value.strip()
        if not address:
            raise ValueError("Restaurant address cannot be empty.")
        return address

    @model_validator(mode="after")
    def validate_coordinates(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must both be provided.")
        return self


class RestaurantSettingsUpdate(BaseModel):
    address: str = Field(min_length=1, max_length=500)
    tariff_per_km: float = Field(ge=0, le=10000)
    latitude: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    longitude: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)

    @field_validator("address")
    @classmethod
    def validate_settings_address(cls, value: str) -> str:
        address = value.strip()
        if not address:
            raise ValueError("Restaurant address cannot be empty.")
        return address

    @model_validator(mode="after")
    def validate_coordinates(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must both be provided.")
        return self


class OrderItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)


class RestaurantOrderCreate(BaseModel):
    delivery_address: str = Field(min_length=1, max_length=500)
    delivery_latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    delivery_longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)
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


class OrderEstimateCreate(BaseModel):
    delivery_address: str = Field(min_length=1, max_length=500)
    items: list[OrderItemCreate] = Field(min_length=1)

    @field_validator("delivery_address")
    @classmethod
    def validate_estimate_address(cls, value: str) -> str:
        address = value.strip()
        if not address:
            raise ValueError("Delivery address cannot be empty.")
        return address
