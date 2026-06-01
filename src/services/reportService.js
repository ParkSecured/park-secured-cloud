const { query } = require('../config/db');
const { ROLES } = require('../utils/roles');
const accessEventService = require('./accessEventService');

const buildScopeCondition = (user, params) => {
    if (user.role === ROLES.ADMIN || user.role === ROLES.HR) {
        return '';
    }

    params.push(user.divisionId);
    return ` AND e.division_id = $${params.length}`;
};

const getIndividualReport = async (employeeId, user) => {
    const events = await accessEventService.getEventsForEmployee(employeeId, user);

    return {
        employeeId,
        totalEvents: events.length,
        allowedEvents: events.filter((event) => event.eventStatus === 'ALLOWED').length,
        deniedEvents: events.filter((event) => event.eventStatus === 'DENIED').length,
        events
    };
};

const getDivisionReport = async (divisionId, user) => {
    const params = [divisionId];
    const roleScope = buildScopeCondition(user, params);

    const result = await query(
        `SELECT
            d.division_id,
            d.name AS division_name,
            COUNT(ae.event_id)::int AS total_events,
            COUNT(ae.event_id) FILTER (WHERE ae.event_status = 'ALLOWED')::int AS allowed_events,
            COUNT(ae.event_id) FILTER (WHERE ae.event_status = 'DENIED')::int AS denied_events,
            COUNT(DISTINCT ae.employee_id)::int AS employees_with_events
         FROM divisions d
         LEFT JOIN employees e ON e.division_id = d.division_id
         LEFT JOIN access_events ae ON ae.employee_id = e.employee_id
         WHERE d.division_id = $1${roleScope}
         GROUP BY d.division_id, d.name`,
        params
    );

    return result.rows[0] || null;
};

const getGlobalReport = async (user) => {
    const params = [];
    const whereClause = user.role === ROLES.ADMIN || user.role === ROLES.HR
        ? ''
        : `WHERE e.division_id = $1`;

    if (user.role !== ROLES.ADMIN && user.role !== ROLES.HR) {
        params.push(user.divisionId);
    }

    const result = await query(
        `SELECT
            COUNT(ae.event_id)::int AS total_events,
            COUNT(*) FILTER (WHERE ae.event_status = 'ALLOWED')::int AS allowed_events,
            COUNT(*) FILTER (WHERE ae.event_status = 'DENIED')::int AS denied_events,
            COUNT(DISTINCT e.employee_id)::int AS total_employees,
            COUNT(DISTINCT e.division_id)::int AS total_divisions
         FROM employees e
         LEFT JOIN access_events ae ON ae.employee_id = e.employee_id
         ${whereClause}`,
        params
    );

    return result.rows[0];
};

module.exports = {
    getIndividualReport,
    getDivisionReport,
    getGlobalReport
};
