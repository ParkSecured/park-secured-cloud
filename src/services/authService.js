const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

const buildUserResponse = (user) => ({
    accountId: user.account_id,
    email: user.email,
    role: user.role,
    divisionId: user.division_id,
    employeeId: user.employee_id,
    isActive: user.is_active
});

const login = async ({ email, password }) => {
    const result = await query(
        `SELECT a.account_id, a.email, a.password_hash, a.role, a.employee_id, a.is_active,
                e.division_id
         FROM accounts a
         LEFT JOIN employees e ON e.employee_id = a.employee_id
         WHERE a.email = $1`,
        [email]
    );

    const user = result.rows[0];

    if (!user || !user.is_active) {
        return null;
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
        return null;
    }

    const token = jwt.sign(
        {
            accountId: user.account_id,
            email: user.email,
            role: user.role,
            divisionId: user.division_id,
            employeeId: user.employee_id
        },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
    );

    return {
        token,
        user: buildUserResponse(user)
    };
};

module.exports = {
    login
};
