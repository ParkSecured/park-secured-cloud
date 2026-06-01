# ParkSecure Backend

Backend REST pentru modulul cloud ParkSecure: utilizatori si roluri, angajati,
asociere unica angajat-smartphone, evenimente de acces si rapoarte.

## Live deployment

```text
API base URL: https://park-secured-cloud-r62j.onrender.com/api
API docs:     https://park-secured-cloud-r62j.onrender.com/api/docs
Frontend:     https://park-secure-vrxr.onrender.com/
```

This service is the single API used by the web dashboard, mobile app and embedded gate firmware.

## Database

The backend uses PostgreSQL. Create the schema with:

```powershell
psql $env:DATABASE_URL -f db/schema.sql
```

If the database already exists from an older version, apply migrations in order:

```powershell
psql $env:DATABASE_URL -f db/migrations/001_add_smartphone_access_seed.sql
psql $env:DATABASE_URL -f db/migrations/002_add_hr_role.sql
psql $env:DATABASE_URL -f db/migrations/003_add_user_employee_reference.sql
psql $env:DATABASE_URL -f db/migrations/004_rename_users_to_accounts.sql
psql $env:DATABASE_URL -f db/migrations/005_add_pending_device_change_support.sql
psql $env:DATABASE_URL -f db/migrations/006_repair_accounts_schema_for_cloud.sql
psql $env:DATABASE_URL -f db/migrations/007_add_divisions_created_at.sql
```

Initial admin account:

```text
email: admin@parksecure.local
password: admin123
```

Change this password after first login in a real deployment.

Optional demo HR account:

```text
email: hr@parksecure.local
password: admin123
```

For an existing database, create or repair the demo HR account with:

```sql
INSERT INTO accounts (email, password_hash, role, division_id, is_active)
VALUES (
  'hr@parksecure.local',
  '$2b$10$2rQU5Drt6QyImytbWglMQ.opIMPH36dK7bpRSO5g87dWzRHLtJB.m',
  'hr',
  NULL,
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  role = 'hr',
  division_id = NULL,
  is_active = TRUE;
```

The demo password hash above is for `admin123`; change this password in a real deployment.

## Main API endpoints

The public API keeps `/api/users` for frontend compatibility, but internally those records are stored in the `accounts` table.

```text
POST /api/auth/login
GET  /api/users
POST /api/users
PUT  /api/users/:id
DELETE /api/admin/users/:id
GET  /api/divisions
POST /api/divisions
GET  /api/employees
GET  /api/employees/:id
POST /api/employees
PUT  /api/employees/:id
PATCH /api/employees/:id/toggle-access
POST /api/devices/register
GET  /api/devices/:employeeId
POST /api/access-events
GET  /api/access-events
POST /api/access/validate-seed
POST /api/mobile/login-secure
POST /api/mobile/me
POST /api/mobile/monthly-report
POST /api/validate-access
GET  /api/gate/status
GET  /api/gate/access-list
GET  /api/reports/individual/:employeeId
GET  /api/reports/division/:divisionId
GET  /api/reports/global
```

Protected web endpoints require:

```text
Authorization: Bearer <jwt>
```

The gate/ESP32 can send access events using:

```text
X-Gate-Api-Key: <GATE_API_KEY>
```

## Roles and permissions

```text
admin
hr
division_manager
operator
viewer
```

`admin` can manage the whole system, including divisions, accounts, employees, permanent deletes and global reports.

`hr` can manage personnel and ordinary web/cloud accounts:

- create accounts with role `division_manager`, `operator` or `viewer`
- update accounts that are not `admin` or `hr`
- add and update employees
- associate employees with divisions
- activate or deactivate employee access
- view personnel reports

`hr` cannot create or modify `admin`/`hr` accounts and cannot permanently delete data.

`division_manager` can view and update employees only inside their own division.

`operator` can view employees and logs and can create access events where allowed.

`viewer` has read-only access.

## Accounts and employees

`accounts` are authentication records for the web/cloud app: email, password hash, role, permissions and login state.

`employees` are physical company employees who enter or exit through the gate.

`accounts.employee_id` is an optional reference to `employees.employee_id`.
Use it when a web/cloud account also belongs to a real employee record, for example a viewer account created for an employee.

Rules:

- one employee can have maximum one account
- multiple accounts can have `employee_id = NULL`
- technical admin and HR accounts can exist without an associated employee
- if the linked employee is deleted, `accounts.employee_id` becomes `NULL`, but the account remains in the system

Final relevant schema:

```sql
accounts(
  account_id,
  email,
  password_hash,
  role,
  division_id,
  employee_id,
  is_active,
  created_at
)

employees(
  employee_id,
  first_name,
  last_name,
  cnp,
  photo_url,
  badge_code,
  division_id,
  bluetooth_code,
  car_number,
  access_start_time,
  access_end_time,
  is_active,
  granted_by_account_id,
  created_at,
  updated_at
)
```

Example account body sent to the compatibility endpoint `POST /api/users`:

```json
{
  "email": "sorin@parksecure.local",
  "password": "sorin123",
  "role": "viewer",
  "divisionId": 1,
  "employeeId": 1,
  "isActive": true
}
```

## Demo requests on Render

Base URL:

```text
<RENDER_URL>
```

## Demo seed data

For testing, the project has controlled seed and cleanup SQL files:

```text
db/seeds/demo_data.sql
db/seeds/demo_cleanup.sql
```

`demo_data.sql` adds demo rows in:

- `divisions`
- `accounts`
- `employees`
- `smartphones`
- `access_events`

The seed is idempotent: running it again updates the same demo accounts/employees/devices and recreates only the demo access events.

Demo account passwords use the same demo hash as `admin123`.

To remove only the seeded demo data, run:

```powershell
node scripts/run-migration.js db/seeds/demo_cleanup.sql
```

## Mobile compatibility endpoints

The mobile prototype from `message(3).txt` can use these compatibility endpoints:

```text
POST /api/mobile/login-secure
POST /api/mobile/me
POST /api/mobile/monthly-report
POST /api/validate-access
```

`POST /api/mobile/login-secure` authenticates an `accounts` record linked to an `employees` record, creates/replaces the smartphone session and returns `accessSeed`.

Example:

```http
POST <RENDER_URL>/api/mobile/login-secure
Content-Type: application/json

{
  "email": "manager.demo@parksecure.local",
  "password": "admin123",
  "platform": "ios",
  "deviceIdentifier": "ios-hw-demo-12345"
}
```

`POST /api/validate-access` receives only `accessSeed` and returns the mobile-compatible `authorized` response.

`POST /api/mobile/me` receives `accessSeed` and returns the employee/device data that the mobile app can display: identity, division, car number, access interval and who granted access.

`POST /api/mobile/monthly-report` receives `accessSeed` and returns the current month access events for that employee.

Example:

```http
POST <RENDER_URL>/api/validate-access
Content-Type: application/json

{
  "accessSeed": "<ACCESS_SEED>"
}
```

The same body shape is used by `/api/mobile/me` and `/api/mobile/monthly-report`.

First, verify that the backend and PostgreSQL connection are working:

```http
GET <RENDER_URL>/api/health
```

```http
GET <RENDER_URL>/api/db-test
```

Log in with the initial admin account and copy the JWT token from the response:

```http
POST <RENDER_URL>/api/auth/login
Content-Type: application/json

{
  "email": "admin@parksecure.local",
  "password": "admin123"
}
```

Or log in with the demo HR account:

```http
POST <RENDER_URL>/api/auth/login
Content-Type: application/json

{
  "email": "hr@parksecure.local",
  "password": "admin123"
}
```

HR can use the returned token to create/update employees and manage ordinary accounts (`division_manager`, `operator`, `viewer`), but cannot create admin/hr accounts or permanently delete data.

Use the token on protected endpoints:

```text
Authorization: Bearer <TOKEN>
```

Create a division:

```http
POST <RENDER_URL>/api/divisions
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "name": "Demo Security"
}
```

List divisions:

```http
GET <RENDER_URL>/api/divisions
Authorization: Bearer <TOKEN>
```

Create an employee. Replace the `divisionId` value with the ID returned by the division request:

```http
POST <RENDER_URL>/api/employees
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "firstName": "Andrei",
  "lastName": "Popescu",
  "cnp": "1990101123456",
  "photoUrl": "https://example.com/andrei-popescu.jpg",
  "badgeCode": "BADGE-DEMO-001",
  "divisionId": 1,
  "bluetoothCode": "BT-DEMO-001",
  "carNumber": "B123DEM",
  "accessStartTime": "08:00",
  "accessEndTime": "18:00",
  "isActive": true
}
```

List employees:

```http
GET <RENDER_URL>/api/employees
Authorization: Bearer <TOKEN>
```

Register a smartphone/device. Replace the `employeeId` value with the ID returned by the employee request.
When a device is registered or re-registered, the cloud generates a new `accessSeed` for the mobile app:

```http
POST <RENDER_URL>/api/devices/register
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "employeeId": 1,
  "platform": "android",
  "deviceIdentifier": "android-demo-device-001",
  "isTrusted": true
}
```

Example response:

```json
{
  "success": true,
  "data": {
    "smartphoneId": 1,
    "employeeId": 1,
    "platform": "android",
    "deviceIdentifier": "android-demo-device-001",
    "accessSeed": "4D7C4F6F1B2A4E6D8C9A0B1C2D3E4F506172839405A6B7C8D9E0F11223344556",
    "isTrusted": true,
    "registeredAt": "2026-05-20T10:00:00.000Z"
  }
}
```

`accessSeed` is a secret generated by the cloud for the registered smartphone.
Mobile uses it to generate the entry code locally. The ESP32/gate should validate
that code locally and then send the final access event to the cloud. The cloud
does not make the main ALLOWED/DENIED access decision.

Check the registered device:

```http
GET <RENDER_URL>/api/devices/<employeeId>
Authorization: Bearer <TOKEN>
```

The `GET /api/devices/<employeeId>` response does not return `accessSeed`.
The seed is returned only when the device is registered or re-registered.

Validate an `accessSeed` sent by ESP32/gate for the demo access flow:

`POST /api/access/validate-seed` is the online validation variant used by the prototype/demo.
In this flow, the ESP32 receives the seed from the mobile phone over Bluetooth, asks the Cloud API if the seed is valid, receives `ALLOWED` or `DENIED`, and only then commands the gate.
The cloud is therefore used as the demo validation authority for this endpoint.

```http
POST <RENDER_URL>/api/access/validate-seed
X-Gate-Api-Key: <GATE_API_KEY>
Content-Type: application/json

{
  "accessSeed": "<ACCESS_SEED>",
  "eventType": "ENTRY",
  "gateCode": "GATE-01"
}
```

Allowed response:

```json
{
  "success": true,
  "status": "ALLOWED",
  "employee": {
    "employeeId": 1,
    "firstName": "Ana",
    "lastName": "Popescu",
    "carNumber": "TM01ABC"
  }
}
```

Denied response:

```json
{
  "success": false,
  "status": "DENIED",
  "message": "Invalid access seed"
}
```

For demo, `accessSeed` is checked directly in PostgreSQL. For production, store and compare a hash instead of the plain seed.
When a seed matches a known smartphone, the backend writes an `access_events` row with `ALLOWED` or `DENIED`.
An unknown seed returns `DENIED` without an event row because there is no known `employee_id` for the current schema.

Logging behavior for seed validation:

- unknown `accessSeed`: returns `DENIED`, no `access_events` row is created
- known `accessSeed` but untrusted smartphone: returns `DENIED` and creates an `access_events` row
- known `accessSeed` but inactive employee: returns `DENIED` and creates an `access_events` row
- known `accessSeed` but outside the allowed interval: returns `DENIED` and creates an `access_events` row
- valid `accessSeed`: returns `ALLOWED` and creates an `access_events` row

Create an access event after the ESP32/gate has made the local access decision.
Replace the `employeeId` and `smartphoneId` values with the IDs returned by the previous requests:

```http
POST <RENDER_URL>/api/access-events
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "employeeId": 1,
  "smartphoneId": 1,
  "eventType": "ENTRY",
  "eventStatus": "ALLOWED",
  "gateCode": "GATE-01",
  "source": "web-demo",
  "notes": "Demo access event"
}
```

List access events:

```http
GET <RENDER_URL>/api/access-events
Authorization: Bearer <TOKEN>
```

Synchronize active access data for ESP32/gate local validation:

```http
GET <RENDER_URL>/api/gate/access-list
X-Gate-Api-Key: <GATE_API_KEY>
```

This endpoint returns active employees, access intervals, Bluetooth codes, trusted smartphone metadata and `accessSeed`.
It is intended only for the gate/ESP32 sync flow, not for the web UI.

## Demo flow complet

Short flow:

```text
Login admin
-> creare divizie
-> creare angajat
-> register smartphone
-> se genereaza accessSeed
-> ESP32/mobile trimite accessSeed la /api/access/validate-seed
-> cloud returneaza ALLOWED/DENIED
-> se salveaza access_event
-> web afiseaza loguri si rapoarte
```

1. Check backend health:

```http
GET <RENDER_URL>/api/health
```

2. Log in as admin or HR and copy the JWT:

```http
POST <RENDER_URL>/api/auth/login
Content-Type: application/json

{
  "email": "admin@parksecure.local",
  "password": "admin123"
}
```

3. Create or choose a division:

```http
POST <RENDER_URL>/api/divisions
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "name": "Demo Security"
}
```

4. Create an employee:

```http
POST <RENDER_URL>/api/employees
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "firstName": "Ana",
  "lastName": "Popescu",
  "cnp": "2990101123456",
  "photoUrl": "https://example.com/ana-popescu.jpg",
  "badgeCode": "BADGE-DEMO-010",
  "divisionId": 1,
  "bluetoothCode": "BT-ANA-010",
  "carNumber": "TM01ABC",
  "accessStartTime": "08:00",
  "accessEndTime": "18:00",
  "isActive": true
}
```

5. Register the employee smartphone. Save the returned `accessSeed`.

```http
POST <RENDER_URL>/api/devices/register
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "employeeId": 1,
  "platform": "android",
  "deviceIdentifier": "android-ana-demo-010",
  "isTrusted": true
}
```

6. ESP32/gate validates the seed received from mobile:

```http
POST <RENDER_URL>/api/access/validate-seed
X-Gate-Api-Key: <GATE_API_KEY>
Content-Type: application/json

{
  "accessSeed": "<ACCESS_SEED>",
  "eventType": "ENTRY",
  "gateCode": "GATE-01"
}
```

7. Check the access log:

```http
GET <RENDER_URL>/api/access-events
Authorization: Bearer <JWT_TOKEN>
```

8. Check reports:

```http
GET <RENDER_URL>/api/reports/individual/<employeeId>
Authorization: Bearer <JWT_TOKEN>
```

```http
GET <RENDER_URL>/api/reports/division/<divisionId>
Authorization: Bearer <JWT_TOKEN>
```

```http
GET <RENDER_URL>/api/reports/global
Authorization: Bearer <JWT_TOKEN>
```

In the demo flow, the cloud validates `accessSeed` directly. In a production system, store only a hash of the seed and compare hashes.

## Run with Docker

1. Start Docker Desktop.
2. Make sure `.env` exists in this folder and contains `JWT_SECRET` and `GATE_API_KEY`.
3. Build and start the backend:

```powershell
docker compose up --build
```

The API will be available at:

```text
http://localhost:3000/api/health
```

Swagger UI will be available at:

```text
http://localhost:3000/api/docs
```

The OpenAPI JSON document is available at:

```text
http://localhost:3000/api/docs.json
```

Docker Compose also starts a local PostgreSQL container and loads `db/schema.sql`
the first time the database volume is created.

To run it in the background:

```powershell
docker compose up --build -d
```

Useful commands:

```powershell
docker compose logs -f
docker compose down
```

If port `3000` is already used on Windows, set another host port before starting:

```powershell
$env:HOST_PORT="3001"
docker compose up --build
```

Then open:

```text
http://localhost:3001/api/health
```

## Upload to GitHub

Create an empty GitHub repository, then run these commands in this folder:

```powershell
git init
git add .
git commit -m "Prepare ParkSecure backend for Docker and Render"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Do not commit `.env`. It contains local secrets and is already ignored by Git.

## Deploy on Render

1. Push this repository to GitHub.
2. In Render, create a new Blueprint or Web Service from the GitHub repo.
3. If using the Blueprint flow, Render reads `render.yaml`.
4. Add the requested environment variable value from your Render PostgreSQL database:

```text
DATABASE_URL
GATE_API_KEY
```

`JWT_SECRET` is generated automatically by Render. `GATE_API_KEY` must be set manually and used by the ESP32/gate when sending access events.

After deploy, test:

```text
<RENDER_URL>/api/health
```
