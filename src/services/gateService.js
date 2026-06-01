const { query } = require('../config/db');

const hardwareStatus = {
    state: 'Inchisa',
    activeLed: 'Galben',
    esp32: 'Conectat',
    lastSync: new Date().toISOString()
};

const updateHardwareStatus = ({ hardwareState, hardwareLed }) => {
    hardwareStatus.state = hardwareState || hardwareStatus.state;
    hardwareStatus.activeLed = hardwareLed || hardwareStatus.activeLed;
    hardwareStatus.lastSync = new Date().toISOString();

    return {
        ...hardwareStatus,
        commandOpen: hardwareStatus.state === 'Deschisa'
    };
};

const getHardwareStatus = async () => {
    let cloudStatus = null;

    try {
        cloudStatus = await getGateStatus();
    } catch {
        cloudStatus = null;
    }

    if (cloudStatus?.lastEvent) {
        const allowed = cloudStatus.lastEvent.eventStatus === 'ALLOWED';
        return {
            state: allowed ? 'Deschisa' : 'Inchisa',
            activeLed: allowed ? 'Verde' : 'Rosu',
            esp32: hardwareStatus.esp32,
            lastSync: hardwareStatus.lastSync,
            commandOpen: allowed
        };
    }

    return {
        ...hardwareStatus,
        commandOpen: hardwareStatus.state === 'Deschisa'
    };
};

// Aceeași funcție robustă din accessEventService — suportă intervale peste miezul nopții
const isCurrentTimeInAccessWindow = (accessStartTime, accessEndTime) => {
    if (!accessStartTime || !accessEndTime) return true;
    const now = new Date();
    const currentSeconds = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
    const toSeconds = (t) => {
        const [h, m, s = '0'] = String(t).split(':');
        return (Number(h) * 3600) + (Number(m) * 60) + Number(s);
    };
    const start = toSeconds(accessStartTime);
    const end = toSeconds(accessEndTime);
    if (start <= end) return currentSeconds >= start && currentSeconds <= end;
    return currentSeconds >= start || currentSeconds <= end;
};

const toGateAccessEntry = (row) => ({
    employeeId: row.employee_id,
    firstName: row.first_name,
    lastName: row.last_name,
    divisionId: row.division_id,
    divisionName: row.division_name,
    bluetoothCode: row.bluetooth_code,
    carNumber: row.car_number,
    accessStartTime: row.access_start_time,
    accessEndTime: row.access_end_time,
    smartphone: row.smartphone_id
        ? {
            smartphoneId: row.smartphone_id,
            platform: row.platform,
            deviceIdentifier: row.device_identifier,
            accessSeed: row.access_seed,
            isTrusted: row.is_trusted,
            registeredAt: row.registered_at
        }
        : null
});

const getGateAccessList = async () => {
    const result = await query(
        `SELECT e.employee_id,
                e.first_name,
                e.last_name,
                e.division_id,
                d.name AS division_name,
                e.bluetooth_code,
                e.car_number,
                e.access_start_time,
                e.access_end_time,
                s.smartphone_id,
                s.platform,
                s.device_identifier,
                s.access_seed,
                s.is_trusted,
                s.registered_at
         FROM employees e
         INNER JOIN divisions d ON d.division_id = e.division_id
         LEFT JOIN smartphones s ON s.employee_id = e.employee_id AND s.is_trusted = true
         WHERE e.is_active = true
         ORDER BY e.employee_id ASC`
    );

    return {
        generatedAt: new Date().toISOString(),
        items: result.rows.map(toGateAccessEntry)
    };
};

const getGateStatus = async () => {
    const result = await query(
        `SELECT ae.event_id,
                ae.employee_id,
                ae.event_type,
                ae.event_status,
                ae.event_time,
                ae.gate_code,
                ae.source,
                ae.notes,
                e.first_name,
                e.last_name,
                e.car_number,
                e.photo_url
         FROM access_events ae
         INNER JOIN employees e ON e.employee_id = ae.employee_id
         ORDER BY ae.event_time DESC
         LIMIT 1`
    );

    const event = result.rows[0];

    if (!event) {
        return {
            state: 'CLOSED',
            led: 'YELLOW',
            message: 'Gate online, no access events yet',
            lastEvent: null
        };
    }

    const allowed = event.event_status === 'ALLOWED';

    return {
        state: allowed ? 'OPENING' : 'CLOSED',
        led: allowed ? 'GREEN' : 'RED',
        message: allowed ? 'Last access was allowed' : 'Last access was denied',
        lastEvent: {
            eventId: event.event_id,
            employeeId: event.employee_id,
            employeeName: `${event.first_name} ${event.last_name}`,
            carNumber: event.car_number,
            photoUrl: event.photo_url,
            eventType: event.event_type,
            eventStatus: event.event_status,
            eventTime: event.event_time,
            gateCode: event.gate_code,
            source: event.source,
            notes: event.notes
        }
    };
};

const POLL_INTERVAL_MS = 1000;  // verifică rezolvarea la fiecare 1s
const POLL_TIMEOUT_MS  = 60000; // timeout după 60s (același ca la accessSeed)

const validateBluetooth = async (bluetoothCode, direction = 'ENTRY') => {
    // Parsează direcția din codul BLE dacă e în formatul "COD:ENTRY" sau "COD:EXIT"
    let actualCode = bluetoothCode;
    let eventType = direction === 'EXIT' ? 'EXIT' : 'ENTRY';
    const colonIndex = bluetoothCode.lastIndexOf(':');
    if (colonIndex !== -1) {
        const suffix = bluetoothCode.slice(colonIndex + 1).toUpperCase();
        if (suffix === 'ENTRY' || suffix === 'EXIT') {
            actualCode = bluetoothCode.slice(0, colonIndex);
            eventType = suffix;
        }
    }
    // Găsește angajatul activ cu acest cod bluetooth
    const employeeResult = await query(
        `SELECT e.employee_id,
                e.first_name,
                e.last_name,
                e.car_number,
                e.access_start_time,
                e.access_end_time,
                e.photo_url
         FROM employees e
         WHERE e.bluetooth_code = $1
           AND e.is_active = true`,
        [actualCode]
    );

    const employee = employeeResult.rows[0];

    if (!employee) {
        return {
            authorized: false,
            status: 'DENIED',
            message: 'Bluetooth code not recognized'
        };
    }

    const employeeInfo = {
        employeeId: employee.employee_id,
        firstName: employee.first_name,
        lastName: employee.last_name,
        carNumber: employee.car_number,
        photoUrl: employee.photo_url
    };

    // Verifică intervalul orar folosind comparare numerică (nu string)
    const withinSchedule = isCurrentTimeInAccessWindow(
        employee.access_start_time,
        employee.access_end_time
    );
    console.log("withinSchedule:", withinSchedule, "start:", employee.access_start_time, "end:", employee.access_end_time, "now:", new Date().toTimeString());

    // Dacă e în interval — acces direct ALLOWED
    if (withinSchedule) {
        await query(
            `INSERT INTO access_events
                (employee_id, event_type, event_status, source, notes)
             VALUES ($1, $2, 'ALLOWED', 'bluetooth', null)`,
            [employee.employee_id, eventType]
        );

        return {
            authorized: true,
            status: 'ALLOWED',
            message: 'Access granted',
            employee: employeeInfo
        };
    }

    // În afara intervalului — creează eveniment PENDING și așteaptă portarul
    const insertResult = await query(
        `INSERT INTO access_events
            (employee_id, event_type, event_status, source, notes)
         VALUES ($1, $2, 'PENDING', 'bluetooth', 'Access outside allowed time window — awaiting guard decision')
         RETURNING event_id`,
        [employee.employee_id, eventType]
    );

    const eventId = insertResult.rows[0].event_id;

    // Polling: așteptăm până când portarul rezolvă evenimentul (ALLOWED/DENIED)
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

        const pollResult = await query(
            `SELECT event_status FROM access_events WHERE event_id = $1`,
            [eventId]
        );

        const status = pollResult.rows[0]?.event_status;

        if (status === 'ALLOWED') {
            return {
                authorized: true,
                status: 'ALLOWED',
                message: 'Access granted by guard',
                employee: employeeInfo
            };
        }

        if (status === 'DENIED') {
            return {
                authorized: false,
                status: 'DENIED',
                message: 'Access denied by guard',
                employee: employeeInfo
            };
        }

        // Dacă e încă PENDING, continuăm să așteptăm
    }

    // Timeout — portarul nu a răspuns în 60s, refuzăm accesul
    await query(
        `UPDATE access_events SET event_status = 'DENIED', notes = $1 WHERE event_id = $2`,
        ['Access denied: guard did not respond in time', eventId]
    );

    return {
        authorized: false,
        status: 'DENIED',
        message: 'Access denied: guard did not respond in time',
        employee: employeeInfo
    };
};

module.exports = {
    getGateAccessList,
    getGateStatus,
    getHardwareStatus,
    updateHardwareStatus,
    validateBluetooth
};
