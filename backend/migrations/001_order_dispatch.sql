ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE orders
    ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS car_required BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE delivery
    ADD COLUMN IF NOT EXISTS delivery_address TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS delivery_rejection (
    order_id INTEGER NOT NULL REFERENCES delivery(order_id) ON DELETE CASCADE,
    rider_id INTEGER NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (order_id, rider_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_waiting_unassigned
    ON delivery (order_id)
    WHERE rider_id IS NULL AND delivery_status = 'waiting';
