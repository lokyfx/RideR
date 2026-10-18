from typing import Any

from fastapi import APIRouter, HTTPException

from app.database import RESTAURANT_ID, get_connection
from app.schemas import ProductCreate

router = APIRouter(prefix="/api/restaurant", tags=["restaurant"])


@router.get("/products")
def get_products() -> list[dict[str, Any]]:
    with get_connection() as connection:
        return connection.execute(
            """
            SELECT product_id AS id, name, description, price, available
            FROM product
            WHERE restaurant_id = %s
            ORDER BY product_id
            """,
            (RESTAURANT_ID,),
        ).fetchall()


@router.post("/products", status_code=201)
def create_product(product: ProductCreate) -> dict[str, Any]:
    if product.price < 0:
        raise HTTPException(status_code=400, detail="Price cannot be negative.")

    with get_connection() as connection:
        return connection.execute(
            """
            INSERT INTO product (restaurant_id, name, description, price)
            VALUES (%s, %s, %s, %s)
            RETURNING product_id AS id, name, description, price, available
            """,
            (RESTAURANT_ID, product.name.strip(), product.description, product.price),
        ).fetchone()
