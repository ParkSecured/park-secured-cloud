ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS division_id INTEGER REFERENCES divisions(division_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS employee_id INTEGER,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

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
ADD CONSTRAINT uq_account_employee UNIQUE (employee_id);

CREATE INDEX IF NOT EXISTS idx_accounts_division_id ON accounts(division_id);
CREATE INDEX IF NOT EXISTS idx_accounts_employee_id ON accounts(employee_id);
