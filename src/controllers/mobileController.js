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
    getMe,
    getMonthlyReport
};
