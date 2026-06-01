const express = require('express');
const {
    getDeviceChangeRequests,
    resolveDeviceChangeRequest,
    resetEmployeeDevice
} = require('../controllers/deviceChangeController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.get('/device-change-requests', authenticate, authorize(ROLES.ADMIN, ROLES.HR), getDeviceChangeRequests);
router.patch('/device-change-requests/:requestId/resolve', authenticate, authorize(ROLES.ADMIN, ROLES.HR), resolveDeviceChangeRequest);
router.delete('/admin/reset-device/:employeeId', authenticate, authorize(ROLES.ADMIN, ROLES.HR), resetEmployeeDevice);

module.exports = router;
