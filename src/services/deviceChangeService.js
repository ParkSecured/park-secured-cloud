const crypto = require('crypto');
const { query } = require('../config/db');

const toDeviceChangeRequest = (row) => ({
    request_id: row.request_id,
    employee_id: row.employee_id,
    status: row.status,
    requested_at: row.requested_at,
    resolved_at: row.resolved_at,
    old_device_identifier: row.old_device_identifier,
    new_device_identifier: row.new_device_identifier,
    new_platform: row.new_platform,
    first_name: row.first_name,
    last_name: row.last_name,
    badge_code: row.badge_code
});

const getPendingDeviceChangeRequests = async () => {
    const result = await query(
        `SELECT r.request_id,
                r.employee_id,
                r.status,
                r.requested_at,
                r.resolved_at,
                r.old_device_identifier,
                r.new_device_identifier,
                r.new_platform,
                e.first_name,
                e.last_name,
                e.badge_code
         FROM device_change_requests r
         INNER JOIN employees e ON e.employee_id = r.employee_id
         WHERE r.status = 'pending'
         ORDER BY r.requested_at DESC`
    );

    return result.rows.map(toDeviceChangeRequest);
};

const resolveDeviceChangeRequest = async (requestId, status) => {
    if (!['approved', 'rejected'].includes(status)) {
        const error = new Error('status must be approved or rejected');
        error.statusCode = 400;
        throw error;
    }

    const requestResult = await query(
        `UPDATE device_change_requests
         SET status = $1,
             resolved_at = NOW()
         WHERE request_id = $2
           AND status = 'pending'
         RETURNING *`,
        [status, requestId]
    );

    if (requestResult.rowCount === 0) {
        const error = new Error('Device change request not found or already resolved');
        error.statusCode = 404;
        throw error;
    }

    const request = requestResult.rows[0];

    if (status === 'approved') {
        const accessSeed = crypto.randomBytes(32).toString('hex').toUpperCase();

        await query(
            `DELETE FROM smartphones
             WHERE employee_id = $1
                OR device_identifier = $2`,
            [request.employee_id, request.new_device_identifier]
        );

        await query(
            `INSERT INTO smartphones (employee_id, platform, device_identifier, access_seed, is_trusted)
             VALUES ($1, $2, $3, $4, true)`,
            [
                request.employee_id,
                request.new_platform || 'mobile',
                request.new_device_identifier,
                accessSeed
            ]
        );
    }

    return {
        request_id: request.request_id,
        employee_id: request.employee_id,
        status: request.status,
        resolved_at: request.resolved_at
    };
};

const resetEmployeeDevice = async (employeeId) => {
    const result = await query(
        `DELETE FROM smartphones
         WHERE employee_id = $1`,
        [employeeId]
    );

    return {
        deleted: result.rowCount
    };
};

module.exports = {
    getPendingDeviceChangeRequests,
    resolveDeviceChangeRequest,
    resetEmployeeDevice
};
