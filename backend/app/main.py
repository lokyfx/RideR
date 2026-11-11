from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, dashboard, restaurant

app = FastAPI(title="Riderboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "message": "Backend connection is working"}


app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(restaurant.router)
