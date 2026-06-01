const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../config/db');
const accessEventService = require('./accessEventService');

const loginSecure = async ({ email, password, platform, deviceIdentifier }) => {
    const accountResult = await query(
        `SELECT a.account_id,
                a.email,
                a.password_hash,
                a.role,
                a.is_active AS account_active,
                a.must_change_password,
                a.employee_id,
                e.first_name,
                e.last_name,
                e.is_active AS employee_active,
                e.access_start_time,
                e.access_end_time
         FROM accounts a
         INNER JOIN employees e ON e.employee_id = a.employee_id
         WHERE a.email = $1`,
        [email]
    );

    const account = accountResult.rows[0];

    if (!account) {
        return null;
    }

    if (!account.account_active || !account.employee_active) {
        const error = new Error('This account or employee access is inactive');
        error.statusCode = 403;
        throw error;
    }

    const passwordMatches = await bcrypt.compare(password, account.password_hash);

    if (!passwordMatches) {
        return null;
    }

    const accessSeed = crypto.randomBytes(32).toString('hex').toUpperCase();

    // verifică dacă există deja un dispozitiv înregistrat pentru angajat
    const existingDeviceResult = await query(
        `SELECT device_identifier FROM smartphones WHERE employee_id = $1`,
        [account.employee_id]
    );

    const existingDevice = existingDeviceResult.rows[0];

    // Dacă există un device diferit → cerere de schimbare, nu înlocuire directă
    if (existingDevice && existingDevice.device_identifier !== deviceIdentifier) {
        const oldDeviceIdentifier = existingDevice.device_identifier;

        // Verifică dacă există deja o cerere pending pentru acest angajat
        const existingRequest = await query(
            `SELECT request_id FROM device_change_requests
             WHERE employee_id = $1 AND status = 'pending'`,
            [account.employee_id]
        );

        if (existingRequest.rows.length === 0) {
            await query(
                `INSERT INTO device_change_requests (employee_id, old_device_identifier, new_device_identifier, new_platform, status)
                 VALUES ($1, $2, $3, $4, 'pending')`,
                [account.employee_id, oldDeviceIdentifier, deviceIdentifier, platform || 'mobile']
            );
        }

        const error = new Error('Există deja un dispozitiv înregistrat pentru acest cont. Cererea de schimbare a fost trimisă către HR.');
        error.statusCode = 403;
        throw error;
    }

    // Nu există device sau e același device → înregistrare normală
    await query(
        `DELETE FROM smartphones WHERE employee_id = $1 OR device_identifier = $2`,
        [account.employee_id, deviceIdentifier]
    );

    await query(
        `INSERT INTO smartphones (employee_id, platform, device_identifier, access_seed, is_trusted)
         VALUES ($1, $2, $3, $4, true)`,
        [account.employee_id, platform || 'mobile', deviceIdentifier, accessSeed]
    );

    return {
        accessSeed,
        mustChangePassword: account.must_change_password === true,
        user: {
            accountId: account.account_id,
            employeeId: account.employee_id,
            email: account.email,
            name: `${account.first_name} ${account.last_name}`,
            role: account.role,
            accessStartTime: account.access_start_time,
            accessEndTime: account.access_end_time
        }
    };
};

// FIX: destructurăm eventType corect
const validateAccess = async ({ accessSeed, eventType }) => {
    const result = await accessEventService.validateAccessSeed({
        accessSeed,
        eventType: eventType || 'ENTRY',
        gateCode: 'GATE_MAIN'
    });

    if (result.status === 'PENDING') {
        return {
            authorized: false,
            status: 'PENDING',
            eventId: result.eventId,
            message: result.message
        };
    }

    if (!result.success || result.status !== 'ALLOWED') {
        return {
            authorized: false,
            status: result.status || 'DENIED',
            message: result.message || 'Access denied'
        };
    }

    return {
        authorized: true,
        status: 'ALLOWED',
        name: `${result.employee.firstName} ${result.employee.lastName}`,
        employee: result.employee
    };
};

const changePassword = async ({ email, currentPassword, newPassword }) => {
    const accountResult = await query(
        `SELECT account_id, password_hash, is_active
         FROM accounts
         WHERE email = $1`,
        [email]
    );

    const account = accountResult.rows[0];

    if (!account || !account.is_active) {
        const error = new Error('Account not found or inactive');
        error.statusCode = 404;
        throw error;
    }

    const passwordMatches = await bcrypt.compare(currentPassword, account.password_hash);

    if (!passwordMatches) {
        const error = new Error('Parola curentă este incorectă');
        error.statusCode = 401;
        throw error;
    }

    if (newPassword.length < 8) {
        const error = new Error('Parola nouă trebuie să aibă minim 8 caractere');
        error.statusCode = 400;
        throw error;
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await query(
        `UPDATE accounts
         SET password_hash = $1, must_change_password = false
         WHERE account_id = $2`,
        [newPasswordHash, account.account_id]
    );

    return { success: true };
};

const getMobileSession = async (accessSeed) => {
    const result = await query(
        `SELECT s.smartphone_id,
                s.platform,
                s.device_identifier,
                s.is_trusted,
                s.registered_at,
                e.employee_id,
                e.first_name,
                e.last_name,
                e.photo_url,
                e.badge_code,
                e.division_id,
                d.name AS division_name,
                e.bluetooth_code,
                e.car_number,
                e.access_start_time,
                e.access_end_time,
                e.is_active,
                e.granted_by_account_id,
                a.email AS granted_by_email,
                COALESCE(ae.first_name || ' ' || ae.last_name, a.email) AS granted_by_name,
                COALESCE(
                    json_agg(
                        json_build_object('employeeId', c.employee_id, 'firstName', c.first_name, 'lastName', c.last_name)
                    ) FILTER (WHERE c.employee_id IS NOT NULL),
                    '[]'
                ) AS colleagues
         FROM smartphones s
         INNER JOIN employees e ON e.employee_id = s.employee_id
         INNER JOIN divisions d ON d.division_id = e.division_id
         LEFT JOIN accounts a ON a.account_id = e.granted_by_account_id
         LEFT JOIN employees ae ON ae.employee_id = a.employee_id
         LEFT JOIN employees c ON c.division_id = e.division_id AND c.employee_id != e.employee_id AND c.is_active = true
         WHERE s.access_seed = $1
         GROUP BY s.smartphone_id, s.platform, s.device_identifier, s.is_trusted, s.registered_at,
                  e.employee_id, e.first_name, e.last_name, e.photo_url, e.badge_code,
                  e.division_id, d.name, e.bluetooth_code, e.car_number, e.access_start_time,
                  e.access_end_time, e.is_active, e.granted_by_account_id, a.email, ae.first_name, ae.last_name`,
        [accessSeed]
    );

    return result.rows[0] || null;
};

const getMe = async ({ accessSeed }) => {
    const session = await getMobileSession(accessSeed);

    if (!session) {
        return null;
    }

    return {
        smartphone: {
            smartphoneId: session.smartphone_id,
            platform: session.platform,
            deviceIdentifier: session.device_identifier,
            isTrusted: session.is_trusted,
            registeredAt: session.registered_at
        },
        employee: {
            employeeId: session.employee_id,
            firstName: session.first_name,
            lastName: session.last_name,
            photoUrl: session.photo_url,
            badgeCode: session.badge_code,
            divisionId: session.division_id,
            divisionName: session.division_name,
            bluetoothCode: session.bluetooth_code,
            carNumber: session.car_number,
            accessStartTime: session.access_start_time,
            accessEndTime: session.access_end_time,
            isActive: session.is_active,
            grantedByAccountId: session.granted_by_account_id,
            grantedByEmail: session.granted_by_email,
            grantedByName: session.granted_by_name,
            colleagues: (session.colleagues || []).map((c) => ({
                employeeId: c.employeeId,
                name: `${c.firstName} ${c.lastName}`
            }))
        }
    };
};

const getMonthlyReport = async ({ accessSeed }) => {
    const session = await getMobileSession(accessSeed);

    if (!session) {
        return null;
    }

    const result = await query(
        `SELECT event_id,
                employee_id,
                smartphone_id,
                event_type,
                event_status,
                event_time,
                gate_code,
                source,
                notes
         FROM access_events
         WHERE employee_id = $1
           AND event_time >= date_trunc('month', NOW())
           AND event_time < date_trunc('month', NOW()) + INTERVAL '1 month'
         ORDER BY event_time DESC`,
        [session.employee_id]
    );

    const events = result.rows.map((event) => ({
        eventId: event.event_id,
        employeeId: event.employee_id,
        smartphoneId: event.smartphone_id,
        eventType: event.event_type,
        eventStatus: event.event_status,
        eventTime: event.event_time,
        gateCode: event.gate_code,
        source: event.source,
        notes: event.notes
    }));

    return {
        employeeId: session.employee_id,
        month: new Date().toISOString().slice(0, 7),
        totalEvents: events.length,
        allowedEvents: events.filter((event) => event.eventStatus === 'ALLOWED').length,
        deniedEvents: events.filter((event) => event.eventStatus === 'DENIED').length,
        events
    };
};

module.exports = {
    loginSecure,
    validateAccess,
    changePassword,
    getMe,
    getMonthlyReport
};
