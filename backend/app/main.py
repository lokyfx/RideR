import os
from typing import Any

import psycopg
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from psycopg.rows import dict_row

app = FastAPI(title="Riderboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.environ.get("DATABASE_URL")
rider_online = True
selected_order = None


def get_connection() -> psycopg.Connection:
    if not DATABASE_URL:
        raise HTTPException(status_code=503, detail="DATABASE_URL is not configured.")
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


class RiderStatus(BaseModel):
    online: bool


class LoginCredentials(BaseModel):
    username: str
    password: str


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "message": "Backend connection is working"}


@app.post("/api/login")
def login(credentials: LoginCredentials) -> dict[str, str]:
    with get_connection() as connection:
        user = connection.execute(
            "SELECT username, password_hash FROM app_user WHERE username = %s",
            (credentials.username,),
        ).fetchone()

    if not user or user["password_hash"] != credentials.password:
        raise HTTPException(status_code=401, detail="Hibás felhasználónév vagy jelszó.")

    return {"username": user["username"]}


@app.get("/api/dashboard")
def get_dashboard() -> dict[str, Any]:
    global selected_order

    with get_connection() as connection:
        rider_row = connection.execute(
            "SELECT user_id, username FROM app_user WHERE role = 'rider' ORDER BY user_id LIMIT 1",
        ).fetchone()
        order_rows = connection.execute(
            """
            SELECT o.order_id, u.username AS customer, r.name AS restaurant,
                   r.address, o.order_status
            FROM orders o
            JOIN app_user u ON u.user_id = o.customer_id
            JOIN restaurant r ON r.restaurant_id = o.restaurant_id
            ORDER BY o.order_id
            """,
        ).fetchall()
        delivery_count = connection.execute(
            "SELECT COUNT(*) AS count FROM delivery WHERE rider_id = %s AND delivery_status = 'delivered'",
            (rider_row["user_id"],),
        ).fetchone()["count"] if rider_row else 0

    orders = [
        {
            "id": f"#{row['order_id']}",
            "customer": row["customer"],
            "restaurant": row["restaurant"],
            "address": row["address"],
            "status": row["order_status"].replace("_", " ").title(),
            "position": [46.523665071133486, 24.599028238137638],
        }
        for row in order_rows
    ]
    if selected_order is None and orders:
        selected_order = orders[0]["id"]

    rider_name = rider_row["username"] if rider_row else "Rider"
    return {
        "rider": {
            "name": rider_name,
            "initials": rider_name[:2].upper(),
            "online": rider_online,
            "date": "Today",
            "stats": {
                "deliveries": delivery_count,
                "earned": 0,
                "rating": 0,
                "average_time": "-",
            },
            "selected_order": selected_order,
        },
        "orders": orders,
        "center": [46.523665071133486, 24.599028238137638],
    }


@app.patch("/api/rider/status")
def update_rider_status(status: RiderStatus) -> dict[str, bool]:
    global rider_online
    rider_online = status.online
    return {"online": rider_online}


@app.patch("/api/orders/{order_id}/select")
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
