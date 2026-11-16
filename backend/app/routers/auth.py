import hashlib
import hmac
import secrets

import psycopg
from fastapi import APIRouter, HTTPException, Query

from app.categories import ensure_restaurant_categories
from app.database import RESTAURANT_ID, get_connection
from app.schemas import LoginCredentials, PhoneNumberUpdate, RegistrationCredentials

router = APIRouter(prefix="/api")
PASSWORD_HASH_ITERATIONS = 600_000


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


@router.post("/login")
def login(credentials: LoginCredentials) -> dict[str, str]:
    with get_connection() as connection:
        user = connection.execute(
            "SELECT username, password_hash, role FROM app_user WHERE username = %s",
            (credentials.username,),
        ).fetchone()

    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Hibás felhasználónév vagy jelszó.")

    return {"username": user["username"], "role": user["role"]}


@router.post("/register", status_code=201)
def register(credentials: RegistrationCredentials) -> dict[str, str]:
    try:
        with get_connection() as connection:
            connection.execute(
                """
                INSERT INTO app_user (
                    username, password_hash, role, phone_number, vehicle_type
                )
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    credentials.username,
                    hash_password(credentials.password),
                    credentials.role,
                    credentials.phone_number,
                    "car" if credentials.role == "rider" and credentials.has_car else "other",
                ),
            )
            if credentials.role == "restaurant":
                restaurant_id = connection.execute(
                    """
                    INSERT INTO restaurant (name, address, phone_number)
                    VALUES (%s, %s, %s)
                    RETURNING restaurant_id
                    """,
                    (credentials.username, "", credentials.phone_number),
                ).fetchone()["restaurant_id"]
                connection.execute(
                    """
                    INSERT INTO category (restaurant_id, name)
                    SELECT %s, name
                    FROM category
                    WHERE restaurant_id = %s
                    """,
                    (restaurant_id, RESTAURANT_ID),
                )
                ensure_restaurant_categories(connection, restaurant_id)
    except psycopg.errors.UniqueViolation as error:
        raise HTTPException(status_code=409, detail="Ez a felhasználónév már foglalt.") from error

    return {"username": credentials.username}


@router.put("/profile/phone")
def update_profile_phone(
    phone: PhoneNumberUpdate, username: str = Query(...)
) -> dict[str, str]:
    with get_connection() as connection:
        user = connection.execute(
            """
            UPDATE app_user
            SET phone_number = %s
            WHERE username = %s
            RETURNING role
            """,
            (phone.phone_number, username),
        ).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        if user["role"] == "restaurant":
            restaurant = connection.execute(
                """
                UPDATE restaurant
                SET phone_number = %s
                WHERE name = %s
                RETURNING restaurant_id
                """,
                (phone.phone_number, username),
            ).fetchone()
            if not restaurant:
                raise HTTPException(status_code=404, detail="Restaurant not found.")

    return {"phone_number": phone.phone_number}
