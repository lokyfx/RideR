from typing import Any

from fastapi import APIRouter, HTTPException

from app.database import RESTAURANT_ID, get_connection
from app.schemas import ProductCreate

router = APIRouter(prefix="/api/restaurant", tags=["restaurant"])


@router.get("/name")
def get_restaurant_name() -> dict[str, str]:
    with get_connection() as connection:
        restaurant = connection.execute(
            "SELECT name FROM restaurant WHERE restaurant_id = %s",
            (RESTAURANT_ID,),
        ).fetchone()

    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found.")
    return {"name": restaurant["name"]}


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


@router.get("/categories")
def get_categories() -> list[dict[str, Any]]:
    with get_connection() as connection:
        return connection.execute(
            """
            SELECT category_id AS id, name
            FROM category
            WHERE restaurant_id = %s
            ORDER BY name
            """,
            (RESTAURANT_ID,),
        ).fetchall()


@router.post("/products", status_code=201)
def create_product(product: ProductCreate) -> dict[str, Any]:
    if product.price < 0:
        raise HTTPException(status_code=400, detail="Price cannot be negative.")
    if product.stock < 0:
        raise HTTPException(status_code=400, detail="Stock cannot be negative.")

    with get_connection() as connection:
        return connection.execute(
            """
            INSERT INTO product (restaurant_id, category_id, name, description, price, stock)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING product_id AS id, category_id, name, description, price, stock, available
            """,
            (RESTAURANT_ID, product.category_id, product.name.strip(), product.description, product.price, product.stock),
        ).fetchone()
