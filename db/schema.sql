CREATE TABLE IF NOT EXISTS divisions (
    division_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
    account_id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'hr', 'division_manager', 'operator', 'viewer')),
    division_id INTEGER REFERENCES divisions(division_id) ON DELETE SET NULL,
    employee_id INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
    employee_id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    cnp VARCHAR(20) NOT NULL UNIQUE,
    photo_url TEXT,
    badge_code VARCHAR(50) UNIQUE,
    division_id INTEGER NOT NULL REFERENCES divisions(division_id) ON DELETE RESTRICT,
    bluetooth_code VARCHAR(100) UNIQUE,
    car_number VARCHAR(30),
    access_start_time TIME,
    access_end_time TIME,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    granted_by_account_id INTEGER REFERENCES accounts(account_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    ALTER TABLE accounts
    DROP CONSTRAINT IF EXISTS fk_accounts_employees;

    ALTER TABLE accounts
    ADD CONSTRAINT fk_accounts_employees
    FOREIGN KEY (employee_id)
    REFERENCES employees(employee_id)
    ON DELETE SET NULL;

    ALTER TABLE accounts
    DROP CONSTRAINT IF EXISTS uq_account_employee;

    ALTER TABLE accounts
    ADD CONSTRAINT uq_account_employee
    UNIQUE (employee_id);
END $$;

CREATE TABLE IF NOT EXISTS smartphones (
    smartphone_id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL UNIQUE REFERENCES employees(employee_id) ON DELETE CASCADE,
    platform VARCHAR(20) NOT NULL,
    device_identifier VARCHAR(255) NOT NULL UNIQUE,
    access_seed VARCHAR(64) NOT NULL UNIQUE,
    is_trusted BOOLEAN NOT NULL DEFAULT TRUE,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS access_events (
    event_id BIGSERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    smartphone_id INTEGER REFERENCES smartphones(smartphone_id) ON DELETE SET NULL,
    event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('ENTRY', 'EXIT')),
    event_status VARCHAR(30) NOT NULL CHECK (event_status IN ('ALLOWED', 'DENIED', 'PENDING')),
    event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    gate_code VARCHAR(50),
    source VARCHAR(50) NOT NULL DEFAULT 'gate',
    notes TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by_account_id INTEGER REFERENCES accounts(account_id) ON DELETE SET NULL
);

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

CREATE INDEX IF NOT EXISTS idx_employees_division_id ON employees(division_id);
CREATE INDEX IF NOT EXISTS idx_accounts_employee_id ON accounts(employee_id);
CREATE INDEX IF NOT EXISTS idx_access_events_employee_time ON access_events(employee_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_access_events_time ON access_events(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_access_events_pending ON access_events(event_status, event_time DESC) WHERE event_status = 'PENDING';
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_change_requests_one_pending ON device_change_requests(employee_id) WHERE status = 'pending';

INSERT INTO divisions (name)
VALUES ('General')
ON CONFLICT (name) DO NOTHING;

INSERT INTO accounts (email, password_hash, role, division_id, is_active)
SELECT
    'admin@parksecure.local',
    '$2b$10$2rQU5Drt6QyImytbWglMQ.opIMPH36dK7bpRSO5g87dWzRHLtJB.m',
    'admin',
    NULL,
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM accounts WHERE email = 'admin@parksecure.local'
);
