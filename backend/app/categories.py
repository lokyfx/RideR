from psycopg import Connection


DEFAULT_CATEGORIES = ("Előételek", "Főételek", "Desszertek", "Italok")

# dsd
def ensure_restaurant_categories(
    connection: Connection, restaurant_id: int
) -> None:
    connection.execute(
        """
        INSERT INTO category (restaurant_id, name)
        SELECT %s, defaults.name
        FROM (VALUES (%s), (%s), (%s), (%s)) AS defaults(name)
        WHERE NOT EXISTS (
            SELECT 1
            FROM category
            WHERE restaurant_id = %s
        )
        """,
        (restaurant_id, *DEFAULT_CATEGORIES, restaurant_id),
    )
