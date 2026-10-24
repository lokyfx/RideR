import hashlib
import hmac
import secrets

import psycopg
from fastapi import APIRouter, HTTPException

from app.database import get_connection
from app.schemas import LoginCredentials, RegistrationCredentials

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
