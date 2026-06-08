const CONSTRAINT_MESSAGES = {
    divisions_name_key: 'Division name already exists',
    users_email_key: 'Email already exists',
    accounts_email_key: 'Email already exists',
    uq_account_employee: 'Employee already has an account',
    employees_cnp_key: 'CNP already exists',
    employees_badge_code_key: 'Badge code already exists',
    employees_bluetooth_code_key: 'Bluetooth code already exists',
    smartphones_employee_id_key: 'Employee already has a registered smartphone',
    smartphones_device_identifier_key: 'Device identifier already exists',
    idx_smartphones_access_seed: 'Device access seed already exists'
};

const getPgErrorResponse = (error) => {
    if (!error || !error.code) {
        return null;
    }

    if (error.code === '23505') {
        return {
            status: 409,
            message: CONSTRAINT_MESSAGES[error.constraint] || 'Resource already exists'
        };
    }

    if (error.code === '23503') {
        return {
            status: 404,
            message: 'Referenced resource not found'
        };
    }

    if (error.code === '23514' || error.code === '22P02') {
        return {
            status: 400,
            message: 'Invalid request value'
        };
    }

    return null;
};

const sendControllerError = (res, error, fallbackMessage) => {
     console.error(`[ERROR] ${fallbackMessage}:`, error.message, '| constraint:', error.constraint);
    if (error.statusCode) {
        return res.status(error.statusCode).json({
            success: false,
            message: error.message
        });
    }

    const pgError = getPgErrorResponse(error);

    if (pgError) {
        return res.status(pgError.status).json({
            success: false,
            message: pgError.message
        });
    }

    return res.status(500).json({
        success: false,
        message: fallbackMessage,
        error: error.message
    });
};

module.exports = {
    sendControllerError
};
