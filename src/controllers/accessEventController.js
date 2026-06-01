const accessEventService = require('../services/accessEventService');
const { sendControllerError } = require('../utils/apiErrors');

const createAccessEvent = async (req, res) => {
    const { employeeId, eventType, eventStatus } = req.body;

    if (!employeeId || !eventType || !eventStatus) {
        return res.status(400).json({
            success: false,
            message: 'employeeId, eventType and eventStatus are required'
        });
    }

    if (!['ENTRY', 'EXIT'].includes(eventType)) {
        return res.status(400).json({
            success: false,
            message: 'eventType must be ENTRY or EXIT'
        });
    }

    if (!['ALLOWED', 'DENIED', 'PENDING'].includes(eventStatus)) {
        return res.status(400).json({
            success: false,
            message: 'eventStatus must be ALLOWED, DENIED or PENDING'
        });
    }

    try {
        const event = await accessEventService.createAccessEvent(req.body);

        return res.status(201).json({
            success: true,
            data: event
        });
    } catch (error) {
        return sendControllerError(res, error, 'Could not create access event');
    }
};

const getAccessEvents = async (req, res) => {
    try {
        const events = await accessEventService.getAccessEvents(req.query, req.user);

        return res.status(200).json({
            success: true,
            data: events
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Could not fetch access events',
            error: error.message
        });
    }
};

const exportAccessEventsCsv = async (req, res) => {
    try {
        const csv = await accessEventService.getAccessEventsCsv(req.query, req.user);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="parksecure-access-events.csv"');

        return res.status(200).send(csv);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Could not export access events',
            error: error.message
        });
    }
};

const validateAccessSeed = async (req, res) => {
    const { accessSeed, eventType, gateCode } = req.body;

    if (!accessSeed || !eventType) {
        return res.status(400).json({
            success: false,
            status: 'DENIED',
            message: 'accessSeed and eventType are required'
        });
    }

    if (!['ENTRY', 'EXIT'].includes(eventType)) {
        return res.status(400).json({
            success: false,
            status: 'DENIED',
            message: 'eventType must be ENTRY or EXIT'
        });
    }

    try {
        const validationResult = await accessEventService.validateAccessSeed({
            accessSeed,
            eventType,
            gateCode
        });

        return res.status(200).json(validationResult);
    } catch (error) {
        return sendControllerError(res, error, 'Could not validate access seed');
    }
};

const getPendingEvent = async (req, res) => {
    const { eventId } = req.params;

    try {
        const event = await accessEventService.getPendingEvent(Number(eventId));

        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        return res.status(200).json({ success: true, data: event });
    } catch (error) {
        return sendControllerError(res, error, 'Could not fetch pending event');
    }
};

const resolveAccessEvent = async (req, res) => {
    const { eventId } = req.params;
    const { resolution } = req.body;

    if (!resolution) {
        return res.status(400).json({ success: false, message: 'resolution is required (ALLOWED or DENIED)' });
    }

    try {
        const event = await accessEventService.resolveAccessEvent(Number(eventId), resolution, req.user?.accountId);
        return res.status(200).json({ success: true, data: event });
    } catch (error) {
        return sendControllerError(res, error, 'Could not resolve access event');
    }
};

module.exports = {
    createAccessEvent,
    getAccessEvents,
    exportAccessEventsCsv,
    validateAccessSeed,
    getPendingEvent,
    resolveAccessEvent
};
