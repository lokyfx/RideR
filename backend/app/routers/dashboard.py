from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.database import get_connection
from app.schemas import RiderStatus

router = APIRouter(prefix="/api")
rider_online = True
selected_order = None


@router.get("/dashboard")
def get_dashboard(username: str = Query(...)) -> dict[str, Any]:
    global selected_order

    with get_connection() as connection:
        rider = connection.execute(
            "SELECT user_id, username FROM app_user WHERE username = %s AND role = 'rider'",
            (username,),
        ).fetchone()
        rows = connection.execute(
            """
             SELECT o.order_id, u.username AS customer, r.name AS restaurant,
                 r.address, d.delivery_status
            FROM orders o
            JOIN app_user u ON u.user_id = o.customer_id
            JOIN restaurant r ON r.restaurant_id = o.restaurant_id
             JOIN delivery d ON d.order_id = o.order_id
             WHERE d.rider_id = %s
            ORDER BY o.order_id
            """,
             (rider["user_id"],),
         ).fetchall() if rider else []
        deliveries = connection.execute(
            """
            SELECT COUNT(*) AS count, COALESCE(SUM(o.total_amount), 0) AS earned
            FROM delivery d
            JOIN orders o ON o.order_id = d.order_id
            WHERE d.rider_id = %s AND d.delivery_status = 'delivered'
            """,
            (rider["user_id"],),
        ).fetchone() if rider else {"count": 0, "earned": 0}

    orders = [
        {
            "id": f"#{row['order_id']}",
            "customer": row["customer"],
            "restaurant": row["restaurant"],
            "address": row["address"],
            "status": row["delivery_status"].replace("_", " ").title(),
        }
        for row in rows
    ]
    if selected_order is None and orders:
        selected_order = orders[0]["id"]

    name = rider["username"] if rider else "Rider"
    return {
        "rider": {
            "name": name,
            "initials": name[:2].upper(),
            "online": rider_online,
            "date": "Today",
            "stats": {"deliveries": deliveries["count"], "earned": float(deliveries["earned"]), "rating": 0, "average_time": "-"},
            "selected_order": selected_order,
        },
        "orders": orders,
        "center": [46.523665071133486, 24.599028238137638],
    }


@router.patch("/rider/status")
def update_rider_status(status: RiderStatus) -> dict[str, bool]:
    global rider_online
    rider_online = status.online
    return {"online": rider_online}


@router.patch("/orders/{order_id}/select")
def select_order(order_id: str) -> dict[str, str]:
    global selected_order
    with get_connection() as connection:
        order = connection.execute(
            "SELECT order_id FROM orders WHERE order_id = %s",
            (order_id.removeprefix("#"),),
        ).fetchone()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    selected_order = order_id
    return {"selected_order": selected_order}
