import os

import psycopg
from dotenv import load_dotenv
from fastapi import HTTPException
from psycopg.rows import dict_row

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
RESTAURANT_ID = int(os.environ.get("RESTAURANT_ID", "1"))


def get_connection() -> psycopg.Connection:
    if not DATABASE_URL:
        raise HTTPException(status_code=503, detail="DATABASE_URL is not configured.")
    try:
        return psycopg.connect(DATABASE_URL, row_factory=dict_row, connect_timeout=15)
    except psycopg.OperationalError as error:
        raise HTTPException(status_code=503, detail="Database is unavailable.") from error
