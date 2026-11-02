from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.database import get_connection
from app.schemas import RiderStatus

router = APIRouter(prefix="/api")


@router.get("/dashboard")
def get_dashboard(username: str = Query(...)) -> dict[str, Any]:
    with get_connection() as connection:
        rider = connection.execute(
            """
            SELECT user_id, username, is_online
            FROM app_user
            WHERE username = %s AND role = 'rider'
            """,
            (username,),
        ).fetchone()
        if not rider:
            raise HTTPException(status_code=404, detail="Rider not found.")

        rows = connection.execute(
            """
            SELECT o.order_id, COALESCE(customer.username, 'Vendég') AS customer,
                 r.name AS restaurant, d.delivery_address AS address,
                 d.delivery_status, o.car_required, (d.rider_id IS NULL) AS is_offer
            FROM delivery d
            JOIN orders o ON o.order_id = d.order_id
            JOIN restaurant r ON r.restaurant_id = o.restaurant_id
            LEFT JOIN app_user customer ON customer.user_id = o.customer_id
            WHERE d.rider_id = %s
               OR (
                   %s IS TRUE
                   AND d.rider_id IS NULL
                   AND d.delivery_status = 'waiting'
                   AND NOT EXISTS (
                       SELECT 1
                       FROM delivery_rejection rejection
                       WHERE rejection.order_id = d.order_id
                         AND rejection.rider_id = %s
                   )
               )
            ORDER BY is_offer DESC, o.order_id DESC
            """,
            (rider["user_id"], rider["is_online"], rider["user_id"]),
        ).fetchall()
        deliveries = connection.execute(
            """
            SELECT COUNT(*) AS count, COALESCE(SUM(o.total_amount), 0) AS earned
            FROM delivery d
            JOIN orders o ON o.order_id = d.order_id
            WHERE d.rider_id = %s AND d.delivery_status = 'delivered'
            """,
            (rider["user_id"],),
        ).fetchone()

    orders = [
        {
            "id": f"#{row['order_id']}",
            "customer": row["customer"],
            "restaurant": row["restaurant"],
            "address": row["address"],
            "status": row["delivery_status"].replace("_", " ").title(),
            "car_required": row["car_required"],
            "is_offer": row["is_offer"],
        }
        for row in rows
    ]

    name = rider["username"]
    return {
        "rider": {
            "name": name,
            "initials": name[:2].upper(),
            "online": rider["is_online"],
            "date": "Today",
            "stats": {
                "deliveries": deliveries["count"],
                "earned": float(deliveries["earned"]),
                "rating": 0,
                "average_time": "-",
            },
        },
        "orders": orders,
        "center": [46.523665071133486, 24.599028238137638],
    }


@router.patch("/rider/status")
def update_rider_status(
    status: RiderStatus, username: str = Query(...)
) -> dict[str, bool]:
    with get_connection() as connection:
        rider = connection.execute(
            """
            UPDATE app_user
            SET is_online = %s
            WHERE username = %s AND role = 'rider'
            RETURNING is_online
            """,
            (status.online, username),
        ).fetchone()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found.")
    return {"online": rider["is_online"]}


@router.post("/orders/{order_id}/accept")
def accept_order(order_id: int, username: str = Query(...)) -> dict[str, Any]:
    with get_connection() as connection:
        rider = connection.execute(
            """
            SELECT user_id, is_online
            FROM app_user
            WHERE username = %s AND role = 'rider'
            """,
            (username,),
        ).fetchone()
        if not rider:
            raise HTTPException(status_code=404, detail="Rider not found.")
        if not rider["is_online"]:
            raise HTTPException(status_code=409, detail="Go online before accepting an order.")

        accepted = connection.execute(
            """
            UPDATE delivery AS d
            SET rider_id = %s, delivery_status = 'accepted'
            WHERE d.order_id = %s
              AND d.rider_id IS NULL
              AND d.delivery_status = 'waiting'
              AND EXISTS (
                  SELECT 1 FROM app_user
                  WHERE user_id = %s AND is_online IS TRUE
              )
              AND NOT EXISTS (
                  SELECT 1 FROM delivery_rejection
                  WHERE order_id = d.order_id AND rider_id = %s
              )
            RETURNING d.order_id
            """,
            (rider["user_id"], order_id, rider["user_id"], rider["user_id"]),
        ).fetchone()

    if not accepted:
        raise HTTPException(status_code=409, detail="This order is no longer available.")
    return {"order_id": accepted["order_id"], "status": "accepted"}


@router.post("/orders/{order_id}/decline")
def decline_order(order_id: int, username: str = Query(...)) -> dict[str, Any]:
    with get_connection() as connection:
        rider = connection.execute(
            """
            SELECT user_id, is_online
            FROM app_user
            WHERE username = %s AND role = 'rider'
            """,
            (username,),
        ).fetchone()
        if not rider:
            raise HTTPException(status_code=404, detail="Rider not found.")
        if not rider["is_online"]:
            raise HTTPException(status_code=409, detail="Go online before declining an order.")

        available_order = connection.execute(
            """
            SELECT order_id
            FROM delivery
            WHERE order_id = %s AND rider_id IS NULL AND delivery_status = 'waiting'
            FOR UPDATE
            """,
            (order_id,),
        ).fetchone()
        if not available_order:
            raise HTTPException(
                status_code=409,
                detail="This order is no longer available to decline.",
            )

        declined = connection.execute(
            """
            INSERT INTO delivery_rejection (order_id, rider_id)
            VALUES (%s, %s)
            ON CONFLICT (order_id, rider_id) DO NOTHING
            RETURNING order_id
            """,
            (order_id, rider["user_id"]),
        ).fetchone()

    if not declined:
        raise HTTPException(
            status_code=409,
            detail="This order is no longer available to decline.",
        )
    return {"order_id": declined["order_id"], "status": "declined"}


@router.patch("/orders/{order_id}/select")
def select_order(order_id: str) -> dict[str, str]:
    with get_connection() as connection:
        order = connection.execute(
            "SELECT order_id FROM orders WHERE order_id = %s",
            (order_id.removeprefix("#"),),
        ).fetchone()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"selected_order": f"#{order['order_id']}"}
