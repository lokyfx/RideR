import os

import psycopg
from fastapi import HTTPException
from psycopg.rows import dict_row

DATABASE_URL = os.environ.get("DATABASE_URL")
RESTAURANT_ID = int(os.environ.get("RESTAURANT_ID", "1"))


def get_connection() -> psycopg.Connection:
    if not DATABASE_URL:
        raise HTTPException(status_code=503, detail="DATABASE_URL is not configured.")
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)
