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
        ? `WHERE role NOT IN ('admin', 'hr')`
        : '';

    const result = await query(
        `SELECT account_id, email, role, division_id, employee_id, is_active, created_at
         FROM accounts
         ${whereClause}
         ORDER BY created_at DESC`
    );

    return result.rows.map(toAccountResponse);
};

const createUser = async ({ email, password, role, divisionId, employeeId, isActive = true }) => {
    await ensureEmployeeCanBeLinked(employeeId || null);

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
        `INSERT INTO accounts (email, password_hash, role, division_id, employee_id, is_active, must_change_password)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING account_id, email, role, division_id, employee_id, is_active, created_at`,
        [email, passwordHash, role, divisionId || null, employeeId || null, isActive]
    );

    return toAccountResponse(result.rows[0]);
};

const getUserById = async (accountId) => {
    const result = await query(
        `SELECT account_id, email, role, division_id, employee_id, is_active, created_at
         FROM accounts
         WHERE account_id = $1`,
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
             division_id = $4,
             employee_id = $5,
             is_active = $6
         WHERE account_id = $7
         RETURNING account_id, email, role, division_id, employee_id, is_active, created_at`,
        [
            payload.email !== undefined ? payload.email : existingUser.email,
            passwordHash,
            payload.role !== undefined ? payload.role : existingUser.role,
            payload.divisionId !== undefined ? payload.divisionId : existingUser.divisionId,
            payload.employeeId !== undefined ? payload.employeeId : existingUser.employeeId,
            payload.isActive !== undefined ? payload.isActive : existingUser.isActive,
            accountId
        ]
    );

    return toAccountResponse(result.rows[0]);
};

const deleteUser = async (accountId) => {
    const result = await query(
        `DELETE FROM accounts
         WHERE account_id = $1
         RETURNING account_id, email, role, division_id, employee_id, is_active, created_at`,
        [accountId]
    );

    return result.rows[0] ? toAccountResponse(result.rows[0]) : null;
};

module.exports = {
    getUsers,
    createUser,
    getUserById,
    updateUser,
    deleteUser
};
