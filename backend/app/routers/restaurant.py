from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.categories import ensure_restaurant_categories
from app.database import get_connection
from app.schemas import ProductCreate, RestaurantOrderCreate

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
        ensure_restaurant_categories(connection, restaurant_id)
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


@router.post("/orders", status_code=201)
def create_order(order: RestaurantOrderCreate, username: str = Query(...)) -> dict[str, Any]:
    restaurant_id = get_restaurant_id(username)
    quantities: dict[int, int] = {}
    for item in order.items:
        quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity

    with get_connection() as connection:
        products = connection.execute(
            """
            SELECT product_id, price
            FROM product
            WHERE restaurant_id = %s
              AND product_id = ANY(%s)
              AND available IS TRUE
            FOR SHARE
            """,
            (restaurant_id, list(quantities)),
        ).fetchall()
        product_prices = {product["product_id"]: product["price"] for product in products}
        if len(product_prices) != len(quantities):
            raise HTTPException(
                status_code=400,
                detail="One or more products are unavailable for this restaurant.",
            )

        total_amount = sum(
            (Decimal(product_prices[product_id]) * quantity for product_id, quantity in quantities.items()),
            Decimal("0"),
        )
        order_id = connection.execute(
            """
            INSERT INTO orders (customer_id, restaurant_id, total_amount, order_status, car_required)
            VALUES (NULL, %s, %s, 'pending', %s)
            RETURNING order_id
            """,
            (restaurant_id, total_amount, order.car_required),
        ).fetchone()["order_id"]

        for product_id, quantity in quantities.items():
            connection.execute(
                """
                INSERT INTO order_line (order_id, product_id, quantity, unit_price)
                VALUES (%s, %s, %s, %s)
                """,
                (order_id, product_id, quantity, product_prices[product_id]),
            )

        connection.execute(
            """
            INSERT INTO delivery (
                order_id, rider_id, delivery_status, delivery_address, customer_phone
            )
            VALUES (%s, NULL, 'waiting', %s, %s)
            """,
            (order_id, order.delivery_address, order.customer_phone),
        )

    return {"order_id": order_id, "status": "waiting"}
