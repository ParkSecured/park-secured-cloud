# WEB CLOUD

Acest fisier este pentru un AI sau coleg care trebuie sa inteleaga logica dintre aplicatia web si cloud pentru ParkSecure.

## SCOP

Aplicatia web/cloud este partea de administrare:

- login conturi
- roluri si permisiuni
- administrare angajati
- administrare divizii
- administrare conturi
- asociere account-employee
- asociere employee-smartphone
- loguri de acces
- rapoarte
- status poarta pentru demo

Web-ul nu este telefonul angajatului si nu este ESP32. Web-ul administreaza datele si afiseaza starea sistemului.

## CONCEPTE

### accounts

`accounts` sunt conturile de autentificare in web/cloud.

Campuri:

```text
accountId
email
role
divisionId
employeeId
isActive
createdAt
```

Endpoint-urile externe raman `/api/users`, dar intern tabela este `accounts`.

### employees

`employees` sunt persoanele fizice care intra/ies prin poarta.

Campuri:

```text
employeeId
firstName
lastName
cnp
photoUrl
badgeCode
divisionId
divisionName
bluetoothCode
carNumber
accessStartTime
accessEndTime
isActive
grantedByAccountId
createdAt
updatedAt
```

### divisions

Diviziile grupeaza angajatii.

```text
divisionId
name
createdAt
```

### smartphones

Telefonul asociat angajatului.

```text
smartphoneId
employeeId
platform
deviceIdentifier
isTrusted
registeredAt
```

`accessSeed` este returnat doar la register/re-register.

### access_events

Logurile de acces.

```text
eventId
employeeId
smartphoneId
eventType
eventStatus
eventTime
gateCode
source
notes
```

## ROLURI

### ADMIN

Poate face tot:

- accounts
- employees
- divisions
- devices
- logs
- reports
- delete permanent conturi

### HR

Poate:

- crea/modifica employees
- crea/modifica accounts obisnuite: `division_manager`, `operator`, `viewer`
- activa/dezactiva acces angajat
- vedea rapoarte de personal

Nu poate:

- crea/modifica admin
- crea/modifica hr
- sterge permanent

### DIVISION_MANAGER

Poate vedea/modifica doar angajatii din divizia lui.

### OPERATOR

Poate vedea angajati/loguri si introduce/verifica evenimente unde este permis.

### VIEWER

Doar citire.

## BASE URL

Render:

```text
https://park-secured-cloud-r62j.onrender.com/api
```

Swagger:

```text
https://park-secured-cloud-r62j.onrender.com/api/docs
```

Frontend Render:

```text
https://park-secure-vrxr.onrender.com/
```

## LOGIN WEB

```http
POST /api/auth/login
Content-Type: application/json
```

Request:

```json
{
  "email": "admin@parksecure.local",
  "password": "admin123"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "token": "<JWT>",
    "user": {
      "accountId": 1,
      "email": "admin@parksecure.local",
      "role": "admin",
      "divisionId": null,
      "employeeId": null,
      "isActive": true
    }
  }
}
```

Toate endpoint-urile web protejate folosesc:

```text
Authorization: Bearer <JWT>
```

## ENDPOINT-URI WEB CLOUD

### ACCOUNTS

```text
GET    /api/users
POST   /api/users
PUT    /api/users/:id
DELETE /api/admin/users/:id
```

Create account:

```json
{
  "email": "viewer.demo@parksecure.local",
  "password": "admin123",
  "role": "viewer",
  "divisionId": 4,
  "employeeId": 7,
  "isActive": true
}
```

Reguli:

- admin poate crea orice rol
- HR poate crea doar `division_manager`, `operator`, `viewer`
- `employeeId` este optional
- un employee poate avea maximum un account

### EMPLOYEES

```text
GET   /api/employees
GET   /api/employees/:id
POST  /api/employees
PUT   /api/employees/:id
PATCH /api/employees/:id/toggle-access
```

Create employee:

```json
{
  "firstName": "Ana",
  "lastName": "Popescu",
  "cnp": "2990101000001",
  "photoUrl": "https://example.com/demo/ana-popescu.jpg",
  "badgeCode": "DEMO-BADGE-001",
  "divisionId": 3,
  "bluetoothCode": "BT-DEMO-ANA-001",
  "carNumber": "TM01ANA",
  "accessStartTime": "08:00",
  "accessEndTime": "18:00",
  "isActive": true
}
```

Toggle access:

```json
{
  "isActive": false
}
```

### DIVISIONS

```text
GET  /api/divisions
POST /api/divisions
```

Create:

```json
{
  "name": "Demo Security"
}
```

### DEVICES / SMARTPHONES

```text
POST /api/devices/register
GET  /api/devices/:employeeId
```

Register:

```json
{
  "employeeId": 7,
  "platform": "ios",
  "deviceIdentifier": "ios-demo-device-001",
  "isTrusted": true
}
```

### ACCESS LOGS

```text
GET /api/access-events
GET /api/access-events/export.csv
POST /api/access-events
```

Filtre:

```text
employeeId
divisionId
eventType
from
to
```

Create event:

```json
{
  "employeeId": 7,
  "smartphoneId": 18,
  "eventType": "ENTRY",
  "eventStatus": "ALLOWED",
  "gateCode": "GATE-01",
  "source": "web-demo",
  "notes": "Manual demo event"
}
```

### REPORTS

```text
GET /api/reports/individual/:employeeId
GET /api/reports/division/:divisionId
GET /api/reports/global
```

### GATE STATUS PENTRU DEMO WEB

```text
GET /api/gate/status
```

Returneaza status dedus din ultimul access event:

```json
{
  "success": true,
  "data": {
    "state": "OPENING",
    "led": "GREEN",
    "message": "Last access was allowed",
    "lastEvent": {
      "employeeName": "Elena Dumitru",
      "carNumber": "TM03ELE",
      "eventType": "ENTRY",
      "eventStatus": "ALLOWED"
    }
  }
}
```

## ECRANE WEB RECOMANDATE

### LOGIN

Form cu email/parola, salveaza JWT.

### DASHBOARD

Afiseaza:

- total angajati
- total events
- allowed/denied
- ultimele loguri
- status poarta

### EMPLOYEES

CRUD angajati, poza, masina, divizie, interval orar, activ/inactiv.

### ACCOUNTS

CRUD conturi, roluri, asociere optionala cu employee.

### DIVISIONS

Lista si creare divizii.

### DEVICES

Afisare/register smartphone pentru employee.

### ACCESS LOGS

Tabel cu filtre si export CSV.

### REPORTS

Rapoarte individuale, pe divizie si globale.

### GATE DEMO

Afiseaza:

- stare poarta
- LED curent
- ultimul angajat validat
- poza/masina daca exista

## FLUX WEB CLOUD COMPLET

```text
admin/HR login
-> creeaza divizie
-> creeaza employee
-> creeaza account legat optional de employee
-> register smartphone
-> mobile/ESP32 valideaza acces
-> access_events se populeaza
-> web afiseaza logs, reports, gate status
```

## DATE DEMO

```text
admin@parksecure.local          admin123
hr.demo@parksecure.local        admin123
manager.demo@parksecure.local   admin123
operator.demo@parksecure.local  admin123
viewer.demo@parksecure.local    admin123
```

## IMPORTANT PENTRU AI/FRONTEND

- Foloseste `accountId`, nu `userId`.
- Endpoint-ul `/api/users` inseamna accounts.
- Nu afisa `password_hash`.
- Nu cere upload pentru poza; backend-ul asteapta `photoUrl`.
- HR nu vede/nu creeaza admin/hr.
- Viewer este read-only.
- 401 inseamna nelogat/token expirat.
- 403 inseamna fara drepturi.
- 409 inseamna duplicat: email deja existent sau employee deja asociat cu account.
