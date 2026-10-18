from fastapi import APIRouter, HTTPException

from app.database import get_connection
from app.schemas import LoginCredentials

router = APIRouter(prefix="/api")


@router.post("/login")
def login(credentials: LoginCredentials) -> dict[str, str]:
    with get_connection() as connection:
        user = connection.execute(
            "SELECT username, password_hash FROM app_user WHERE username = %s",
            (credentials.username,),
        ).fetchone()

    if not user or user["password_hash"] != credentials.password:
        raise HTTPException(status_code=401, detail="Hibás felhasználónév vagy jelszó.")

    return {"username": user["username"]}
