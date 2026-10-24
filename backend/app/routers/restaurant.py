from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.database import get_connection
from app.schemas import ProductCreate

router = APIRouter(prefix="/api/restaurant", tags=["restaurant"])


def get_restaurant_id(username: str) -> int:
    with get_connection() as connection:
        restaurant = connection.execute(
            "SELECT restaurant_id FROM restaurant WHERE name = %s",
            (username,),
        ).fetchone()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found.")
    return restaurant["restaurant_id"]


@router.get("/name")
def get_restaurant_name(username: str = Query(...)) -> dict[str, str]:
    restaurant_id = get_restaurant_id(username)
    with get_connection() as connection:
        restaurant = connection.execute(
            "SELECT name FROM restaurant WHERE restaurant_id = %s",
            (restaurant_id,),
        ).fetchone()

    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found.")
    return {"name": restaurant["name"]}


@router.get("/products")
def get_products(username: str = Query(...)) -> list[dict[str, Any]]:
    restaurant_id = get_restaurant_id(username)
    with get_connection() as connection:
        return connection.execute(
            """
            SELECT product_id AS id, name, description, price, available
            FROM product
            WHERE restaurant_id = %s
            ORDER BY product_id
            """,
            (restaurant_id,),
        ).fetchall()


@router.get("/categories")
def get_categories(username: str = Query(...)) -> list[dict[str, Any]]:
    restaurant_id = get_restaurant_id(username)
    with get_connection() as connection:
        return connection.execute(
            """
            SELECT category_id AS id, name
            FROM category
            WHERE restaurant_id = %s
            ORDER BY name
            """,
            (restaurant_id,),
        ).fetchall()


@router.post("/products", status_code=201)
def create_product(product: ProductCreate, username: str = Query(...)) -> dict[str, Any]:
    if product.price < 0:
        raise HTTPException(status_code=400, detail="Price cannot be negative.")
    if product.stock < 0:
        raise HTTPException(status_code=400, detail="Stock cannot be negative.")

    restaurant_id = get_restaurant_id(username)
    with get_connection() as connection:
        return connection.execute(
            """
            INSERT INTO product (restaurant_id, category_id, name, description, price, stock)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING product_id AS id, category_id, name, description, price, stock, available
            """,
            (restaurant_id, product.category_id, product.name.strip(), product.description, product.price, product.stock),
        ).fetchone()
