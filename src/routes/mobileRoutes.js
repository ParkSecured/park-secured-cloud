const express = require('express');
const {
    loginSecure,
    validateAccess,
    changePassword,
    getMe,
    getMonthlyReport,
    getLatestEvent
} = require('../controllers/mobileController');

const router = express.Router();

router.post('/mobile/login-secure', loginSecure);
router.post('/mobile/change-password', changePassword);
router.post('/mobile/me', getMe);
router.post('/mobile/monthly-report', getMonthlyReport);
router.post('/mobile/latest-event', getLatestEvent);
router.post('/validate-access', validateAccess);

module.exports = router;
