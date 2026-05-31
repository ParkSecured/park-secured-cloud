const { query } = require('../config/db');
const { ROLES } = require('../utils/roles');

const toEmployeeResponse = (employee) => ({
    employeeId: employee.employee_id,
    firstName: employee.first_name,
    lastName: employee.last_name,
    cnp: employee.cnp,
    photoUrl: employee.photo_url,
    badgeCode: employee.badge_code,
    divisionId: employee.division_id,
    divisionName: employee.division_name,
    bluetoothCode: employee.bluetooth_code,
    carNumber: employee.car_number,
    accessStartTime: employee.access_start_time,
    accessEndTime: employee.access_end_time,
    isActive: employee.is_active,
    grantedByAccountId: employee.granted_by_account_id,
    createdAt: employee.created_at,
    updatedAt: employee.updated_at
});

const getDivisionFilter = (user, firstParamIndex = 1) => {
    if (user.role === ROLES.DIVISION_MANAGER || user.role === ROLES.VIEWER) {
        return {
            clause: ` WHERE e.division_id = $${firstParamIndex}`,
            params: [user.divisionId]
        };
    }

    return {
        clause: '',
        params: []
    };
};

const getEmployees = async (user) => {
    const filter = getDivisionFilter(user);
    const result = await query(
        `SELECT e.*, d.name AS division_name
         FROM employees e
         INNER JOIN divisions d ON d.division_id = e.division_id
         ${filter.clause}
         ORDER BY e.employee_id DESC`,
        filter.params
    );

    return result.rows.map(toEmployeeResponse);
};

const getEmployeeById = async (employeeId, user) => {
    const filter = getDivisionFilter(user, 2);
    const whereClause = filter.clause
        ? `WHERE e.employee_id = $1 AND e.division_id = $2`
        : 'WHERE e.employee_id = $1';

    const result = await query(
        `SELECT e.*, d.name AS division_name
         FROM employees e
         INNER JOIN divisions d ON d.division_id = e.division_id
         ${whereClause}`,
        [employeeId, ...filter.params]
    );

    return result.rows[0] ? toEmployeeResponse(result.rows[0]) : null;
};

const createEmployee = async (payload, user) => {
    const divisionId = user.role === ROLES.ADMIN || user.role === ROLES.HR
        ? payload.divisionId
        : user.divisionId;

    const result = await query(
        `INSERT INTO employees (
            first_name, last_name, cnp, photo_url, badge_code, division_id,
            bluetooth_code, car_number, access_start_time, access_end_time,
            is_active, granted_by_account_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, true), $12)
         RETURNING *`,
        [
            payload.firstName,
            payload.lastName,
            payload.cnp,
            payload.photoUrl || null,
            payload.badgeCode || null,
            divisionId,
            payload.bluetoothCode || null,
            payload.carNumber || null,
            payload.accessStartTime || null,
            payload.accessEndTime || null,
            payload.isActive,
            user.accountId
        ]
    );

    return getEmployeeById(result.rows[0].employee_id, user);
};

const updateEmployee = async (employeeId, payload, user) => {
    const existingEmployee = await getEmployeeById(employeeId, user);

    if (!existingEmployee) {
        return null;
    }

    const divisionId = user.role === ROLES.ADMIN || user.role === ROLES.HR
        ? (payload.divisionId || existingEmployee.divisionId)
        : existingEmployee.divisionId;

    await query(
        `UPDATE employees
         SET first_name = $1,
             last_name = $2,
             cnp = $3,
             photo_url = $4,
             badge_code = $5,
             division_id = $6,
             bluetooth_code = $7,
             car_number = $8,
             access_start_time = $9,
             access_end_time = $10,
             is_active = $11,
             updated_at = NOW()
         WHERE employee_id = $12`,
        [
            payload.firstName || existingEmployee.firstName,
            payload.lastName || existingEmployee.lastName,
            payload.cnp || existingEmployee.cnp,
            payload.photoUrl !== undefined ? payload.photoUrl : existingEmployee.photoUrl,
            payload.badgeCode !== undefined ? payload.badgeCode : existingEmployee.badgeCode,
            divisionId,
            payload.bluetoothCode !== undefined ? payload.bluetoothCode : existingEmployee.bluetoothCode,
            payload.carNumber !== undefined ? payload.carNumber : existingEmployee.carNumber,
            payload.accessStartTime !== undefined ? payload.accessStartTime : existingEmployee.accessStartTime,
            payload.accessEndTime !== undefined ? payload.accessEndTime : existingEmployee.accessEndTime,
            payload.isActive !== undefined ? payload.isActive : existingEmployee.isActive,
            employeeId
        ]
    );

    return getEmployeeById(employeeId, user);
};

const toggleEmployeeAccess = async (employeeId, isActive, user) => {
    const existingEmployee = await getEmployeeById(employeeId, user);

    if (!existingEmployee) {
        return null;
    }

    await query(
        `UPDATE employees
         SET is_active = $1, updated_at = NOW()
         WHERE employee_id = $2`,
        [isActive, employeeId]
    );

    return getEmployeeById(employeeId, user);
};

module.exports = {
    getEmployees,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    toggleEmployeeAccess
};
