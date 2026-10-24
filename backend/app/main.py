import hashlib
import hmac
import os
import secrets
from pathlib import Path
from typing import Any, Literal

import psycopg
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from psycopg.rows import dict_row

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

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
PASSWORD_HASH_ITERATIONS = 600_000


def get_connection() -> psycopg.Connection:
    if not DATABASE_URL:
        raise HTTPException(status_code=503, detail="DATABASE_URL is not configured.")
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


class RiderStatus(BaseModel):
    online: bool


class LoginCredentials(BaseModel):
    username: str
    password: str


class RegistrationCredentials(BaseModel):
    username: str
    password: str = Field(min_length=8)
    role: Literal["rider", "restaurant"]


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt, PASSWORD_HASH_ITERATIONS
    )
    return f"pbkdf2_sha256${PASSWORD_HASH_ITERATIONS}${salt.hex()}${password_hash.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt, expected_hash = stored_hash.split("$")
        if algorithm != "pbkdf2_sha256":
            return hmac.compare_digest(stored_hash, password)
        actual_hash = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt), int(iterations)
        ).hex()
    except ValueError:
        return hmac.compare_digest(stored_hash, password)

    return hmac.compare_digest(actual_hash, expected_hash)


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

    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Hibás felhasználónév vagy jelszó.")

    return {"username": user["username"]}


@app.post("/api/register", status_code=201)
def register(credentials: RegistrationCredentials) -> dict[str, str]:
    try:
        with get_connection() as connection:
            connection.execute(
                """
                INSERT INTO app_user (username, password_hash, role)
                VALUES (%s, %s, %s)
                """,
                (credentials.username, hash_password(credentials.password), credentials.role),
            )
            if credentials.role == "restaurant":
                connection.execute(
                    "INSERT INTO restaurant (name, address) VALUES (%s, %s)",
                    (credentials.username, ""),
                )
    except psycopg.errors.UniqueViolation as error:
        raise HTTPException(status_code=409, detail="Ez a felhasználónév már foglalt.") from error

    return {"username": credentials.username}


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
