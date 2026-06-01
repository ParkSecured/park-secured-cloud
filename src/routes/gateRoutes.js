const express = require('express');
const { getGateAccessList, getGateStatus, validateBluetooth } = require('../controllers/gateController');
const { authenticate, authenticateGate, authorize } = require('../middlewares/authMiddleware');
const { READ_ROLES } = require('../utils/roles');

const router = express.Router();

router.get('/gate/access-list', authenticateGate, getGateAccessList);
router.get('/gate/status', authenticate, authorize(...READ_ROLES), getGateStatus);
router.post('/gate/validate-bluetooth', authenticateGate, validateBluetooth);

module.exports = router;
