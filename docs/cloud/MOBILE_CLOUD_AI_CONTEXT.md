# MOBILE CLOUD

Acest fisier este pentru un AI sau coleg care trebuie sa inteleaga logica dintre aplicatia mobila si cloud pentru ParkSecure.

## SCOP

Aplicatia mobila este folosita de angajat pentru a obtine si folosi un `accessSeed`.

`accessSeed` este secretul generat de cloud pentru sesiunea telefonului. Telefonul il primeste dupa autentificare si il foloseste pentru fluxul de acces.

In demo:

```text
mobile login
-> cloud verifica account + parola + employee activ
-> cloud genereaza accessSeed
-> cloud salveaza accessSeed in smartphones
-> mobile primeste accessSeed
-> mobile trimite accessSeed pentru validare
-> cloud returneaza authorized true/false
-> cloud scrie access_event
```

## CONCEPTE

### accounts

Conturi de autentificare:

```text
accountId
email
password_hash
role
divisionId
employeeId
isActive
```

Pentru mobile, account-ul trebuie sa fie legat de un employee:

```text
accounts.employee_id -> employees.employee_id
```

Un account fara `employeeId` poate fi admin/HR web, dar nu poate face login mobile util.

### employees

Angajatii fizici:

```text
employeeId
firstName
lastName
photoUrl
badgeCode
divisionId
bluetoothCode
carNumber
accessStartTime
accessEndTime
isActive
```

Pentru acces:

- employee trebuie sa fie activ
- daca are interval `accessStartTime/accessEndTime`, accesul trebuie sa fie in interval

### smartphones

Telefonul asociat angajatului:

```text
smartphoneId
employeeId
platform
deviceIdentifier
accessSeed
isTrusted
registeredAt
```

Reguli:

- un employee are maximum un smartphone activ
- la login mobile, cloud sterge sesiunea veche pentru acel employee sau deviceIdentifier
- apoi creeaza smartphone/session noua cu seed nou
- seed-ul vechi devine invalid

### access_events

Logurile de intrare/iesire:

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

Cand seed-ul este validat, cloud scrie eveniment in `access_events`.

## ENDPOINT-URI MOBILE CLOUD

Base URL Render:

```text
https://park-secured-cloud-r62j.onrender.com/api
```

### 1. MOBILE LOGIN SECURE

```http
POST /api/mobile/login-secure
Content-Type: application/json
```

Request:

```json
{
  "email": "viewer.demo@parksecure.local",
  "password": "admin123",
  "platform": "ios",
  "deviceIdentifier": "ios-hw-demo-12345"
}
```

Ce face cloud-ul:

1. Cauta account in `accounts`.
2. Verifica parola cu bcrypt.
3. Verifica `accounts.is_active`.
4. Verifica daca account-ul are `employee_id`.
5. Verifica `employees.is_active`.
6. Sterge orice smartphone/session veche pentru employee sau deviceIdentifier.
7. Genereaza `accessSeed` nou.
8. Salveaza seed-ul in `smartphones`.
9. Returneaza seed-ul catre mobile.

Response:

```json
{
  "success": true,
  "message": "Autentificare reusita si sesiune unica activata.",
  "accessSeed": "399A0174E053494D17503AB853E84C78B9172D131F5B9B22BD38F8642A5A7326",
  "user": {
    "accountId": 23,
    "employeeId": 7,
    "email": "viewer.demo@parksecure.local",
    "name": "Elena Dumitru",
    "role": "viewer"
  }
}
```

### 2. MOBILE PROFILE / ME

```http
POST /api/mobile/me
Content-Type: application/json
```

Request:

```json
{
  "accessSeed": "<ACCESS_SEED>"
}
```

Ce face cloud-ul:

1. Cauta seed-ul in `smartphones`.
2. Gaseste employee-ul asociat.
3. Returneaza datele proprii ale angajatului.

Response:

```json
{
  "success": true,
  "data": {
    "smartphone": {
      "smartphoneId": 18,
      "platform": "ios",
      "deviceIdentifier": "ios-hw-demo-12345",
      "isTrusted": true,
      "registeredAt": "2026-05-21T16:32:05.576Z"
    },
    "employee": {
      "employeeId": 7,
      "firstName": "Elena",
      "lastName": "Dumitru",
      "photoUrl": "https://example.com/demo/elena-dumitru.jpg",
      "badgeCode": "DEMO-BADGE-003",
      "divisionId": 4,
      "divisionName": "Demo Logistics",
      "bluetoothCode": "BT-DEMO-ELENA-003",
      "carNumber": "TM03ELE",
      "accessStartTime": null,
      "accessEndTime": null,
      "isActive": true,
      "grantedByAccountId": 1,
      "grantedByEmail": "admin@parksecure.local"
    }
  }
}
```

### 3. MOBILE MONTHLY REPORT

```http
POST /api/mobile/monthly-report
Content-Type: application/json
```

Request:

```json
{
  "accessSeed": "<ACCESS_SEED>"
}
```

Ce face cloud-ul:

1. Cauta seed-ul in `smartphones`.
2. Gaseste employee-ul.
3. Returneaza evenimentele angajatului din luna curenta.

Response:

```json
{
  "success": true,
  "data": {
    "employeeId": 7,
    "month": "2026-05",
    "totalEvents": 7,
    "allowedEvents": 6,
    "deniedEvents": 1,
    "events": []
  }
}
```

### 4. MOBILE VALIDATE ACCESS

```http
POST /api/validate-access
Content-Type: application/json
```

Request:

```json
{
  "accessSeed": "<ACCESS_SEED>"
}
```

Ce face cloud-ul:

1. Cauta `accessSeed` in `smartphones`.
2. Verifica `smartphone.is_trusted`.
3. Verifica `employee.is_active`.
4. Verifica intervalul orar daca exista.
5. Scrie `access_event`.
6. Returneaza `authorized`.

Response permis:

```json
{
  "authorized": true,
  "name": "Elena Dumitru",
  "employee": {
    "employeeId": 7,
    "firstName": "Elena",
    "lastName": "Dumitru",
    "carNumber": "TM03ELE"
  }
}
```

Response respins:

```json
{
  "authorized": false,
  "message": "Access outside allowed interval"
}
```

## FLUX CU ESP32

Fluxul demo complet:

```text
mobile primeste accessSeed de la cloud
-> mobile trimite accessSeed prin Bluetooth catre ESP32
-> ESP32 trimite accessSeed la Cloud API
-> cloud verifica seed-ul
-> cloud returneaza ALLOWED/DENIED
-> ESP32 comanda poarta
-> cloud salveaza access_event
```

Endpoint folosit de ESP32/gate:

```http
POST /api/access/validate-seed
X-Gate-Api-Key: <GATE_API_KEY>
Content-Type: application/json
```

Request:

```json
{
  "accessSeed": "<ACCESS_SEED>",
  "eventType": "ENTRY",
  "gateCode": "GATE-01"
}
```

## CONT DEMO RECOMANDAT

Pentru test mobile:

```text
email: viewer.demo@parksecure.local
password: admin123
```

Motiv: employee-ul asociat nu are interval orar restrictiv, deci testele sunt mai simple.

## IMPORTANT

- Mobile nu foloseste JWT in fluxul simplificat.
- Mobile foloseste `accessSeed` ca sesiune/secret.
- Daca userul face login de pe alt device, seed-ul vechi se invalideaza.
- Pentru productie, seed-ul ar trebui stocat hash-uit, nu plain text.
- Pentru demo, seed-ul este plain text in `smartphones.access_seed`.
