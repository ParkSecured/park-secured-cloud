const deviceChangeService = require('../services/deviceChangeService');
const { sendControllerError } = require('../utils/apiErrors');

const getDeviceChangeRequests = async (req, res) => {
    try {
        const requests = await deviceChangeService.getPendingDeviceChangeRequests();

        return res.status(200).json({
            success: true,
            data: requests
        });
    } catch (error) {
        return sendControllerError(res, error, 'Could not fetch device change requests');
    }
};

const resolveDeviceChangeRequest = async (req, res) => {
    const { requestId } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({
            success: false,
            message: 'status is required'
        });
    }

    try {
        const request = await deviceChangeService.resolveDeviceChangeRequest(Number(requestId), status);

        return res.status(200).json({
            success: true,
            data: request
        });
    } catch (error) {
        return sendControllerError(res, error, 'Could not resolve device change request');
    }
};

const resetEmployeeDevice = async (req, res) => {
    const { employeeId } = req.params;

    try {
        const result = await deviceChangeService.resetEmployeeDevice(Number(employeeId));

        if (result.deleted === 0) {
            return res.status(404).json({
                success: false,
                message: 'Employee has no registered device'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Device reset successfully'
        });
    } catch (error) {
        return sendControllerError(res, error, 'Could not reset employee device');
    }
};

module.exports = {
    getDeviceChangeRequests,
    resolveDeviceChangeRequest,
    resetEmployeeDevice
};
