from decimal import Decimal
from typing import Any

import psycopg
from fastapi import APIRouter, HTTPException, Query

from app.categories import ensure_restaurant_categories
from app.database import get_connection
from app.distance_service import DistanceServiceError, get_distance_km
from app.rider_dispatch import dispatch_order, distance_km as straight_line_distance_km
from app.schemas import (
    ProductCreate,
    OrderEstimateCreate,
    RestaurantAddressUpdate,
    RestaurantOrderCreate,
    RestaurantSettingsUpdate,
)

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
def get_restaurant_name(username: str = Query(...)) -> dict[str, Any]:
    restaurant_id = get_restaurant_id(username)
    with get_connection() as connection:
        restaurant = connection.execute(
            """
            SELECT name, address, latitude, longitude, tariff_per_km
            FROM restaurant
            WHERE restaurant_id = %s
            """,
            (restaurant_id,),
        ).fetchone()

    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found.")
    return {
        "name": restaurant["name"],
        "address": restaurant["address"] or "",
        "latitude": restaurant["latitude"],
        "longitude": restaurant["longitude"],
        "tariff_per_km": float(restaurant["tariff_per_km"]),
    }


@router.put("/address")
def update_restaurant_address(
    address_update: RestaurantAddressUpdate, username: str = Query(...)
) -> dict[str, Any]:
    restaurant_id = get_restaurant_id(username)
    with get_connection() as connection:
        restaurant = connection.execute(
            """
            UPDATE restaurant
            SET address = %s, latitude = %s, longitude = %s
            WHERE restaurant_id = %s
            RETURNING address, latitude, longitude
            """,
            (
                address_update.address,
                address_update.latitude,
                address_update.longitude,
                restaurant_id,
            ),
        ).fetchone()

    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found.")
    return {
        "address": restaurant["address"],
        "latitude": restaurant["latitude"],
        "longitude": restaurant["longitude"],
    }


@router.put("/settings")
def update_restaurant_settings(
    settings: RestaurantSettingsUpdate, username: str = Query(...)
) -> dict[str, Any]:
    restaurant_id = get_restaurant_id(username)
    with get_connection() as connection:
        restaurant = connection.execute(
            """
            UPDATE restaurant
            SET address = %s, latitude = %s, longitude = %s, tariff_per_km = %s
            WHERE restaurant_id = %s
            RETURNING address, latitude, longitude, tariff_per_km
            """,
            (
                settings.address,
                settings.latitude,
                settings.longitude,
                settings.tariff_per_km,
                restaurant_id,
            ),
        ).fetchone()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found.")
    return {
        "address": restaurant["address"],
        "latitude": restaurant["latitude"],
        "longitude": restaurant["longitude"],
        "tariff_per_km": float(restaurant["tariff_per_km"]),
    }


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


@router.get("/orders")
def get_restaurant_orders(username: str = Query(...)) -> list[dict[str, Any]]:
    restaurant_id = get_restaurant_id(username)
    with get_connection() as connection:
        return connection.execute(
            """
                 SELECT o.order_id, d.delivery_status AS status, d.delivery_address,
                     rider.username AS rider_name, o.total_amount,
                     o.distance_km, o.delivery_fee
            FROM orders o
            JOIN delivery d ON d.order_id = o.order_id
            LEFT JOIN app_user rider ON rider.user_id = d.rider_id
            WHERE o.restaurant_id = %s
              AND d.delivery_status IN ('waiting', 'accepted', 'delivering', 'delivered')
              AND (d.delivery_status != 'delivered' OR d.restaurant_dismissed_at IS NULL)
              AND NULLIF(BTRIM(d.delivery_address), '') IS NOT NULL
            ORDER BY o.created_at DESC, o.order_id DESC
            """,
            (restaurant_id,),
        ).fetchall()


@router.post("/orders/{order_id}/dismiss")
def dismiss_restaurant_order(
    order_id: int, username: str = Query(...)
) -> dict[str, Any]:
    restaurant_id = get_restaurant_id(username)
    with get_connection() as connection:
        dismissed = connection.execute(
            """
            UPDATE delivery AS d
            SET restaurant_dismissed_at = NOW()
            FROM orders o
            WHERE d.order_id = %s
              AND o.order_id = d.order_id
              AND o.restaurant_id = %s
              AND d.delivery_status = 'delivered'
            RETURNING d.order_id
            """,
            (order_id, restaurant_id),
        ).fetchone()

    if not dismissed:
        raise HTTPException(status_code=404, detail="Delivered order not found.")
    return {"order_id": dismissed["order_id"], "status": "dismissed"}


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


@router.delete("/products/{product_id}")
def delete_product(product_id: int, username: str = Query(...)) -> dict[str, int]:
    restaurant_id = get_restaurant_id(username)
    try:
        with get_connection() as connection:
            connection.execute(
                """
                DELETE FROM order_line AS line
                                WHERE line.product_id = %s
                                    AND EXISTS (
                                            SELECT 1
                                            FROM orders AS order_header
                                            WHERE order_header.order_id = line.order_id
                                                AND order_header.restaurant_id = %s
                                    )
                                    AND NOT EXISTS (
                                            SELECT 1
                                            FROM delivery AS delivery
                                            WHERE delivery.order_id = line.order_id
                                                AND delivery.delivery_status IN (
                                                        'waiting', 'offered', 'accepted', 'delivering'
                                                )
                                    )
                """,
                (product_id, restaurant_id),
            )
            deleted = connection.execute(
                """
                DELETE FROM product
                WHERE product_id = %s AND restaurant_id = %s
                RETURNING product_id
                """,
                (product_id, restaurant_id),
            ).fetchone()
    except psycopg.errors.ForeignKeyViolation as error:
        raise HTTPException(
            status_code=409,
            detail="This product is used in an active order and cannot be deleted.",
        ) from error

    if not deleted:
        raise HTTPException(status_code=404, detail="Product not found.")
    return {"product_id": deleted["product_id"]}


@router.post("/orders", status_code=201)
def create_order(order: RestaurantOrderCreate, username: str = Query(...)) -> dict[str, Any]:
    restaurant_id = get_restaurant_id(username)
    quantities: dict[int, int] = {}
    for item in order.items:
        quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity

    with get_connection() as connection:
        restaurant_location = connection.execute(
            """
            SELECT address, latitude, longitude, tariff_per_km
            FROM restaurant
            WHERE restaurant_id = %s
            """,
            (restaurant_id,),
        ).fetchone()
        if (
            not restaurant_location
            or restaurant_location["latitude"] is None
            or restaurant_location["longitude"] is None
        ):
            raise HTTPException(
                status_code=409,
                detail="Set the restaurant address before creating an order.",
            )

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

        product_total = sum(
            (Decimal(product_prices[product_id]) * quantity for product_id, quantity in quantities.items()),
            Decimal("0"),
        )
        delivery_distance_km = round(
            straight_line_distance_km(
                restaurant_location["latitude"],
                restaurant_location["longitude"],
                order.delivery_latitude,
                order.delivery_longitude,
            ),
            2,
        )
        try:
            route_distance_km = get_distance_km(
                restaurant_location["address"],
                order.delivery_address,
            )
        except DistanceServiceError as distance_error:
            raise HTTPException(status_code=503, detail=str(distance_error)) from distance_error
        route_distance_km = round(route_distance_km, 2)
        delivery_fee = (
            Decimal(str(route_distance_km))
            * Decimal(str(restaurant_location["tariff_per_km"]))
        ).quantize(Decimal("0.01"))
        total_amount = product_total + delivery_fee
        order_id = connection.execute(
            """
            INSERT INTO orders (customer_id, restaurant_id, total_amount, distance_km, delivery_fee, order_status, car_required)
            VALUES (NULL, %s, %s, %s, %s, 'pending', %s)
            RETURNING order_id
            """,
            (restaurant_id, total_amount, route_distance_km, delivery_fee, order.car_required),
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
                order_id, rider_id, delivery_status, delivery_address, customer_phone,
                delivery_latitude, delivery_longitude, delivery_distance_km
            )
            VALUES (%s, NULL, 'waiting', %s, %s, %s, %s, %s)
            """,
            (
                order_id,
                order.delivery_address,
                order.customer_phone,
                order.delivery_latitude,
                order.delivery_longitude,
                delivery_distance_km,
            ),
        )

    return {
        "order_id": order_id,
        "status": "waiting",
        "delivery_distance_km": delivery_distance_km,
        "distance_km": route_distance_km,
        "delivery_fee": float(delivery_fee),
        "total_amount": float(total_amount),
    }


@router.post("/orders/estimate")
def estimate_order(order: OrderEstimateCreate, username: str = Query(...)) -> dict[str, float]:
    restaurant_id = get_restaurant_id(username)
    quantities: dict[int, int] = {}
    for item in order.items:
        quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity

    with get_connection() as connection:
        products = connection.execute(
            """
            SELECT product_id, price
            FROM product
            WHERE restaurant_id = %s AND product_id = ANY(%s) AND available IS TRUE
            """,
            (restaurant_id, list(quantities)),
        ).fetchall()
        product_prices = {product["product_id"]: product["price"] for product in products}
        if len(product_prices) != len(quantities):
            raise HTTPException(status_code=400, detail="One or more products are unavailable.")
        restaurant = connection.execute(
            "SELECT address, tariff_per_km FROM restaurant WHERE restaurant_id = %s",
            (restaurant_id,),
        ).fetchone()

    try:
        distance_km = round(get_distance_km(restaurant["address"], order.delivery_address), 2)
    except DistanceServiceError as distance_error:
        raise HTTPException(status_code=503, detail=str(distance_error)) from distance_error
    product_total = sum(
        (Decimal(product_prices[product_id]) * quantity for product_id, quantity in quantities.items()),
        Decimal("0"),
    )
    delivery_fee = (Decimal(str(distance_km)) * Decimal(restaurant["tariff_per_km"])).quantize(Decimal("0.01"))
    return {
        "distance_km": distance_km,
        "delivery_fee": float(delivery_fee),
        "total_amount": float(product_total + delivery_fee),
    }


@router.post("/orders/{order_id}/find-rider")
def find_rider(order_id: int, username: str = Query(...)) -> dict[str, Any]:
    restaurant_id = get_restaurant_id(username)
    with get_connection() as connection:
        owns_order = connection.execute(
            "SELECT order_id FROM orders WHERE order_id = %s AND restaurant_id = %s",
            (order_id, restaurant_id),
        ).fetchone()
        if not owns_order:
            raise HTTPException(status_code=404, detail="Order not found.")

        assignment = dispatch_order(connection, order_id)

    if not assignment:
        raise HTTPException(status_code=409, detail="No suitable rider is available.")
    return {"status": "offered", **assignment}
