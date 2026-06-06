const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { ROLES } = require('../utils/roles');

const toAccountResponse = (account) => ({
    accountId: account.account_id,
    email: account.email,
    role: account.role,
    divisionId: account.division_id,
    employeeId: account.employee_id,
    isActive: account.is_active,
    createdAt: account.created_at
});

const createError = (statusCode, message) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const ensureEmployeeCanBeLinked = async (employeeId, currentAccountId = null) => {
    if (employeeId === undefined || employeeId === null) {
        return;
    }

    const employeeResult = await query(
        `SELECT employee_id
         FROM employees
         WHERE employee_id = $1`,
        [employeeId]
    );

    if (!employeeResult.rows[0]) {
        throw createError(404, 'Employee not found');
    }

    const accountResult = await query(
        `SELECT account_id
         FROM accounts
         WHERE employee_id = $1
           AND ($2::int IS NULL OR account_id <> $2)`,
        [employeeId, currentAccountId]
    );

    if (accountResult.rows[0]) {
        throw createError(409, 'Employee already has an account');
    }
};

const getUsers = async (user) => {
    const whereClause = user.role === ROLES.HR
        ? `WHERE a.role NOT IN ('admin', 'hr')`
        : '';

    const result = await query(
        `SELECT a.account_id, a.email, a.role, a.employee_id, a.is_active, a.created_at,
                e.division_id
         FROM accounts a
         LEFT JOIN employees e ON e.employee_id = a.employee_id
         ${whereClause}
         ORDER BY a.created_at DESC`
    );

    return result.rows.map(toAccountResponse);
};

const createUser = async ({ email, password, role, divisionId, employeeId, isActive = true }) => {
    await ensureEmployeeCanBeLinked(employeeId || null);

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
        `INSERT INTO accounts (email, password_hash, role, employee_id, is_active, must_change_password)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING account_id, email, role, employee_id, is_active, created_at`,
        [email, passwordHash, role, employeeId || null, isActive]
    );

    const row = result.rows[0];

    // dacă s-a specificat un employeeId, ia division_id din employees
    if (row.employee_id) {
        const empResult = await query(
            `SELECT division_id FROM employees WHERE employee_id = $1`,
            [row.employee_id]
        );
        row.division_id = empResult.rows[0]?.division_id ?? null;
    } else {
        row.division_id = null;
    }

    return toAccountResponse(row);
};

const getUserById = async (accountId) => {
    const result = await query(
        `SELECT a.account_id, a.email, a.role, a.employee_id, a.is_active, a.created_at,
                e.division_id
         FROM accounts a
         LEFT JOIN employees e ON e.employee_id = a.employee_id
         WHERE a.account_id = $1`,
        [accountId]
    );

    return result.rows[0] ? toAccountResponse(result.rows[0]) : null;
};

const updateUser = async (accountId, payload) => {
    const existingUser = await getUserById(accountId);

    if (!existingUser) {
        return null;
    }

    const passwordHash = payload.password
        ? await bcrypt.hash(payload.password, 10)
        : null;

    if (payload.employeeId !== undefined) {
        await ensureEmployeeCanBeLinked(payload.employeeId, accountId);
    }

    const result = await query(
        `UPDATE accounts
         SET email = $1,
             password_hash = COALESCE($2, password_hash),
             role = $3,
             employee_id = $4,
             is_active = $5
         WHERE account_id = $6
         RETURNING account_id, email, role, employee_id, is_active, created_at`,
        [
            payload.email !== undefined ? payload.email : existingUser.email,
            passwordHash,
            payload.role !== undefined ? payload.role : existingUser.role,
            payload.employeeId !== undefined ? payload.employeeId : existingUser.employeeId,
            payload.isActive !== undefined ? payload.isActive : existingUser.isActive,
            accountId
        ]
    );

    const row = result.rows[0];

    if (row.employee_id) {
        const empResult = await query(
            `SELECT division_id FROM employees WHERE employee_id = $1`,
            [row.employee_id]
        );
        row.division_id = empResult.rows[0]?.division_id ?? null;
    } else {
        row.division_id = null;
    }

    return toAccountResponse(row);
};

const deleteUser = async (accountId) => {
    const result = await query(
        `DELETE FROM accounts
         WHERE account_id = $1
         RETURNING account_id, email, role, employee_id, is_active, created_at`,
        [accountId]
    );

    if (!result.rows[0]) return null;

    // division_id nu mai e în accounts, returnăm null pentru că angajatul poate fi deja sters
    result.rows[0].division_id = null;
    return toAccountResponse(result.rows[0]);
};

module.exports = {
    getUsers,
    createUser,
    getUserById,
    updateUser,
    deleteUser
};
