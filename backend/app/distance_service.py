import json
import os
from pathlib import Path
from urllib import error, request


class DistanceServiceError(RuntimeError):
    pass


def get_google_api_key() -> str | None:
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if api_key:
        return api_key

    frontend_env = Path(__file__).parents[2] / "frontend" / ".env.local"
    try:
        for line in frontend_env.read_text().splitlines():
            if line.startswith("VITE_GOOGLE_MAPS_API_KEY="):
                return line.split("=", 1)[1].strip()
    except OSError:
        return None
    return None


def get_distance_km(origin: str, destination: str) -> float:
    api_key = get_google_api_key()
    if not api_key:
        raise DistanceServiceError("VITE_GOOGLE_MAPS_API_KEY is not configured.")

    payload = json.dumps({
        "origin": {"address": origin},
        "destination": {"address": destination},
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE",
    }).encode()
    http_request = request.Request(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": "routes.distanceMeters",
        },
        method="POST",
    )

    try:
        with request.urlopen(http_request, timeout=10) as response:
            data = json.loads(response.read())
    except (error.HTTPError, error.URLError, TimeoutError) as service_error:
        raise DistanceServiceError("Google distance calculation failed.") from service_error

    routes = data.get("routes", [])
    if not routes or "distanceMeters" not in routes[0]:
        raise DistanceServiceError("Google returned no route distance.")
    return routes[0]["distanceMeters"] / 1000
