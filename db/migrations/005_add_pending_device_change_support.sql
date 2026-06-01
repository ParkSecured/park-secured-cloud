ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE access_events
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS resolved_by_account_id INTEGER REFERENCES accounts(account_id) ON DELETE SET NULL;

ALTER TABLE access_events
DROP CONSTRAINT IF EXISTS access_events_event_status_check;

ALTER TABLE access_events
ADD CONSTRAINT access_events_event_status_check
CHECK (event_status IN ('ALLOWED', 'DENIED', 'PENDING'));

CREATE TABLE IF NOT EXISTS device_change_requests (
    request_id BIGSERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    old_device_identifier VARCHAR(255),
    new_device_identifier VARCHAR(255) NOT NULL,
    new_platform VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_change_requests_one_pending
ON device_change_requests(employee_id)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_access_events_pending
ON access_events(event_status, event_time DESC)
WHERE event_status = 'PENDING';
