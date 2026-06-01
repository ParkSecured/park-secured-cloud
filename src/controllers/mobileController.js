const mobileService = require('../services/mobileService');
const { sendControllerError } = require('../utils/apiErrors');

const loginSecure = async (req, res) => {
    const { email, password, platform, deviceIdentifier } = req.body;

    if (!email || !password || !deviceIdentifier) {
        return res.status(400).json({
            success: false,
            message: 'email, password and deviceIdentifier are required'
        });
    }

    try {
        const result = await mobileService.loginSecure({
            email,
            password,
            platform,
            deviceIdentifier
        });

        if (!result) {
            return res.status(401).json({
                success: false,
                message: 'E-mailul sau parola este incorecta.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Autentificare reusita si sesiune unica activata.',
            accessSeed: result.accessSeed,
            mustChangePassword: result.mustChangePassword,
            isNewDevice: result.isNewDevice,
            user: result.user
        });
    } catch (error) {
        return sendControllerError(res, error, 'Mobile login failed');
    }
};

const validateAccess = async (req, res) => {
    const { accessSeed, direction } = req.body;

    if (!accessSeed) {
        return res.status(400).json({
            authorized: false,
            message: 'Lipseste accessSeed.'
        });
    }

    try {
        const result = await mobileService.validateAccess({ accessSeed, eventType: direction || 'ENTRY' });
        const statusCode = result.authorized ? 200 : 403;

        return res.status(statusCode).json(result);
    } catch (error) {
        return sendControllerError(res, error, 'Could not validate mobile access');
    }
};

const changePassword = async (req, res) => {
    const { email, currentPassword, newPassword } = req.body;

    if (!email || !currentPassword || !newPassword) {
        return res.status(400).json({
            success: false,
            message: 'email, currentPassword and newPassword are required'
        });
    }

    try {
        await mobileService.changePassword({ email, currentPassword, newPassword });

        return res.status(200).json({
            success: true,
            message: 'Parola a fost schimbată cu succes.'
        });
    } catch (error) {
        return sendControllerError(res, error, 'Could not change password');
    }
};

const getMe = async (req, res) => {
    const { accessSeed } = req.body;

    if (!accessSeed) {
        return res.status(400).json({
            success: false,
            message: 'accessSeed is required'
        });
    }

    try {
        const data = await mobileService.getMe({ accessSeed });

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Mobile session not found'
            });
        }

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        return sendControllerError(res, error, 'Could not fetch mobile profile');
    }
};

const getMonthlyReport = async (req, res) => {
    const { accessSeed } = req.body;

    if (!accessSeed) {
        return res.status(400).json({
            success: false,
            message: 'accessSeed is required'
        });
    }

    try {
        const report = await mobileService.getMonthlyReport({ accessSeed });

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Mobile session not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: report
        });
    } catch (error) {
        return sendControllerError(res, error, 'Could not fetch mobile monthly report');
    }
};

module.exports = {
    loginSecure,
    validateAccess,
    changePassword,
    getMe,
    getMonthlyReport
};

// Returnează cel mai recent eveniment de acces al angajatului (folosit de mobil după BLE)
const getLatestEvent = async (req, res) => {
    const { accessSeed } = req.body;
    if (!accessSeed) {
        return res.status(400).json({ success: false, message: 'accessSeed is required' });
    }
    try {
        const { query } = require('../config/db');
        const seedResult = await query(
            `SELECT s.employee_id FROM smartphones s WHERE s.access_seed = $1`,
            [accessSeed]
        );
        if (!seedResult.rows[0]) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }
        const employeeId = seedResult.rows[0].employee_id;
        const eventResult = await query(
            `SELECT ae.event_id,
                    ae.event_status,
                    ae.event_time,
                    ae.source,
                    ae.notes,
                    ae.resolved_at,
                    COALESCE(re.first_name || ' ' || re.last_name, ra.email) AS resolved_by_name
             FROM access_events ae
             LEFT JOIN accounts ra ON ra.account_id = ae.resolved_by_account_id
             LEFT JOIN employees re ON re.employee_id = ra.employee_id
             WHERE ae.employee_id = $1
             ORDER BY ae.event_time DESC
             LIMIT 1`,
            [employeeId]
        );
        const event = eventResult.rows[0];
        if (!event) {
            return res.status(404).json({ success: false, message: 'No events found' });
        }
        return res.status(200).json({
            success: true,
            data: {
                eventId: event.event_id,
                eventStatus: event.event_status,
                eventTime: event.event_time,
                source: event.source,
                notes: event.notes,
                resolvedAt: event.resolved_at,
                resolvedByName: event.resolved_by_name || null
            }
        });
    } catch (error) {
        return sendControllerError(res, error, 'Could not fetch latest event');
    }
};

// Suprascrie exports cu getLatestEvent inclus
Object.assign(module.exports, { getLatestEvent });
