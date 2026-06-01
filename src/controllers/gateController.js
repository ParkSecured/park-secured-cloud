const gateService = require('../services/gateService');

const getGateAccessList = async (req, res) => {
    try {
        const accessList = await gateService.getGateAccessList();

        return res.status(200).json({
            success: true,
            data: accessList
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Could not fetch gate access list',
            error: error.message
        });
    }
};

const getGateStatus = async (req, res) => {
    try {
        const status = await gateService.getGateStatus();

        return res.status(200).json({
            success: true,
            data: status
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Could not fetch gate status',
            error: error.message
        });
    }
};

const getHardwareGateStatus = async (req, res) => {
    try {
        const status = await gateService.getHardwareStatus();

        return res.status(200).json(status);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Could not fetch hardware gate status',
            error: error.message
        });
    }
};

const updateHardwareGateStatus = async (req, res) => {
    try {
        const status = gateService.updateHardwareStatus(req.body);

        if (req.body.eventType && req.body.employeeId) {
            const accessEventService = require('../services/accessEventService');
            await accessEventService.createAccessEvent({
                employeeId: req.body.employeeId,
                eventType: req.body.eventType,
                eventStatus: 'ALLOWED',
                gateCode: 'GATE_MAIN',
                source: 'ESP32_HARDWARE',
                notes: 'Trecere completa detectata de hardware'
            });
        }

        return res.status(200).json({
            success: true,
            data: status
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Could not update hardware gate status',
            error: error.message
        });
    }
};

const validateBluetooth = async (req, res) => {
    const { bluetoothCode } = req.body;

    if (!bluetoothCode) {
        return res.status(400).json({
            success: false,
            status: 'DENIED',
            message: 'bluetoothCode is required'
        });
    }

    try {
        const result = await gateService.validateBluetooth(bluetoothCode);
        const statusCode = result.authorized ? 200 : 403;

        return res.status(statusCode).json(result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            status: 'DENIED',
            message: 'Could not validate bluetooth code',
            error: error.message
        });
    }
};

module.exports = {
    getGateAccessList,
    getGateStatus,
    getHardwareGateStatus,
    updateHardwareGateStatus,
    validateBluetooth
};
