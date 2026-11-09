from math import asin, cos, inf, radians, sin, sqrt
from typing import Any


def distance_km(
    first_latitude: float,
    first_longitude: float,
    second_latitude: float | None,
    second_longitude: float | None,
) -> float:
    if second_latitude is None or second_longitude is None:
        return inf

    latitude_delta = radians(second_latitude - first_latitude)
    longitude_delta = radians(second_longitude - first_longitude)
    first_latitude = radians(first_latitude)
    second_latitude = radians(second_latitude)
    haversine = (
        sin(latitude_delta / 2) ** 2
        + cos(first_latitude) * cos(second_latitude) * sin(longitude_delta / 2) ** 2
    )
    return 6371 * 2 * asin(sqrt(haversine))


def choose_rider(
    riders: list[dict[str, Any]],
    restaurant_latitude: float | None,
    restaurant_longitude: float | None,
    car_required: bool,
) -> dict[str, Any] | None:
    if restaurant_latitude is None or restaurant_longitude is None:
        restaurant_latitude = 0
        restaurant_longitude = 0

    required_vehicle_type = "car" if car_required else "other"
    eligible_riders = [
        rider
        for rider in riders
        if rider["is_online"]
        and rider["vehicle_type"] == required_vehicle_type
    ]
    if not eligible_riders:
        return None

    return min(
        eligible_riders,
        key=lambda rider: (
            distance_km(
                restaurant_latitude,
                restaurant_longitude,
                rider["latitude"],
                rider["longitude"],
            ),
            rider["user_id"],
        ),
    )


def dispatch_order(connection: Any, order_id: int) -> dict[str, Any] | None:
    order = connection.execute(
        """
        SELECT o.car_required, r.latitude AS restaurant_latitude,
               r.longitude AS restaurant_longitude
        FROM orders o
        JOIN restaurant r ON r.restaurant_id = o.restaurant_id
        JOIN delivery d ON d.order_id = o.order_id
        WHERE o.order_id = %s
          AND d.rider_id IS NULL
          AND d.delivery_status = 'waiting'
        FOR UPDATE OF d
        """,
        (order_id,),
    ).fetchone()
    if not order:
        return None

    riders = connection.execute(
        """
        SELECT user_id, is_online, vehicle_type, latitude, longitude
        FROM app_user
        WHERE role = 'rider' AND is_online IS TRUE
        """,
    ).fetchall()
    rider = choose_rider(
        riders,
        order["restaurant_latitude"],
        order["restaurant_longitude"],
        order["car_required"],
    )
    if not rider:
        return None

    assignment = connection.execute(
        """
        UPDATE delivery
        SET rider_id = %s, delivery_status = 'offered'
        WHERE order_id = %s AND rider_id IS NULL AND delivery_status = 'waiting'
        RETURNING order_id
        """,
        (rider["user_id"], order_id),
    ).fetchone()
    if not assignment:
        return None

    distance = distance_km(
        order["restaurant_latitude"] or 0,
        order["restaurant_longitude"] or 0,
        rider["latitude"],
        rider["longitude"],
    )
    return {
        "order_id": assignment["order_id"],
        "rider_id": rider["user_id"],
        "distance_km": None if distance == inf else round(distance, 2),
    }
