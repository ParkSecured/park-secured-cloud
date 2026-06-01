const express = require('express');
const {
    loginSecure,
    validateAccess,
    changePassword,
    getMe,
    getMonthlyReport
} = require('../controllers/mobileController');

const router = express.Router();

router.post('/mobile/login-secure', loginSecure);
router.post('/mobile/change-password', changePassword);
router.post('/mobile/me', getMe);
router.post('/mobile/monthly-report', getMonthlyReport);
router.post('/validate-access', validateAccess);

module.exports = router;
