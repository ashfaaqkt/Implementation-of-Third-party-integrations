# 🚚 Fleet Management System – Third-party Integrations, API Gateway

| | |
|---|---|
| **Author** | Ashfaaq Feroz Muhammad |
| **BITS ID** | 2023EBCS005 |
| **Course** | Backend and API Development – BITS Pilani |
| **Topic** | Fleet Management System – Third-party Integrations, API Gateway |

A Node.js microservice backend for a fleet administrator. It tracks vehicle locations, finds nearby vehicles, sends SMS alerts for critical vehicle events and status changes, and documents every API in Swagger UI. All traffic goes through an **Express API Gateway** that handles routing, API-key verification and rate limiting. The project is tested with **Mocha + Chai**: 150 tests across all 7 flows in the brief.

- 🌐 **Live demo:** [https://fleet-management-system-au8x.onrender.com/map](https://fleet-management-system-au8x.onrender.com/map) · [Swagger UI](https://fleet-management-system-au8x.onrender.com/api-docs) · [Health](https://fleet-management-system-au8x.onrender.com/health)
  - Free Render instance: the first request after a quiet period can take about 50 s while it wakes up.
  - Demo API key `devkey123`, admin login `admin@fleet.local` / `Admin@123` (seeded test data only).
- 🖼️ [Screenshots](#screenshots)

---

## Architecture

```mermaid
flowchart LR
    C["Client<br/>(curl · Postman · Swagger UI · /map)"] -->|x-api-key + JWT| G

    subgraph GW["API Gateway :8080"]
      G["Express gateway<br/>API key check → rate limit → proxy"]
      D["/api-docs (Swagger UI)"]
      M["/map (Leaflet)"]
    end

    G -->|/api/users/*| U["User Service :4001"]
    G -->|/api/vehicles/*| V["Vehicle/Fleet Service :4002"]
    G -->|/api/telemetry/*| T["Telemetry Service :4003"]
    G -->|/api/maps/*| GEO["Geolocation Service :4004"]
    G -->|/api/notifications/*| N["Notification Service :4005"]

    V -->|geocode address| GEO
    GEO -->|nearby search| V
    T -->|update location| V
    T -->|critical event SMS| N
    V -->|status change SMS| N
    N -->|recipient phones| U

    U & V & T & GEO & N --> DB[("MongoDB<br/>GeoJSON + 2dsphere")]
    GEO -->|HTTPS| OSM["OpenStreetMap Nominatim<br/>(or Google Maps)"]
    N -->|SMS| SMS["SMS stub<br/>(or Twilio sandbox)"]
```

Each service owns its own database (`fleet_users`, `fleet_vehicles`, `fleet_telemetry`, `fleet_geo`, `fleet_notifications`). Services call each other over HTTP with an `x-internal-token` header, and the gateway strips that header from client requests.

## Tech stack

Node.js 20+ · Express 4 · npm workspaces · MongoDB + Mongoose (GeoJSON `Point`, `2dsphere`, `$geoNear`) · `http-proxy-middleware` · `express-rate-limit` · `helmet` · `cors` · `morgan` · `jsonwebtoken` · `bcryptjs` · `joi` · `axios` · `swagger-jsdoc` + `swagger-ui-express` · Leaflet + OSM tiles · Mocha · Chai · Supertest · Sinon · Nock · c8 · mochawesome · `mongodb-memory-server`.

```
├── gateway/                 API Gateway (routing, API keys, rate limit, Swagger, /map)
├── services/
│   ├── user-service/        register, login, JWT, roles
│   ├── vehicle-service/     vehicles, status + SMS, $geoNear nearby search
│   ├── telemetry-service/   GPS/sensor data, critical events
│   ├── geo-service/         Nominatim / Google / mock geocoding, distance
│   └── notification-service/ SMS stub / Twilio, retry, sent/failed records
├── shared/                  JWT auth, role guard, validation, errors, logger, DB
├── public/map.html          Leaflet map UI
├── scripts/                 dev.js, start-all.js, seed.js, demo.sh
├── test/                    Mocha/Chai test suite (flows/*.flow.js)
└── docs/                    brief, requirements checklist, screenshot checklist
```

## Getting started

**Prerequisites:** Node.js **20 or newer** (`node -v`). MongoDB is optional: if `MONGO_URI` is empty, a local database starts automatically (`mongodb-memory-server`, data stored in `.data/mongo`).

```bash
npm install                 # installs every workspace
cp .env.example .env        # defaults work as-is for local use
npm run seed                # demo users + 11 vehicles around Kochi and Kozhikode
npm run dev                 # local DB + 5 services + gateway
bash scripts/demo.sh        # (2nd terminal) labelled curl walkthrough of every feature
```

**Docker (optional):** `docker compose up --build`, then `docker compose run --rm seed`.

### URLs

| What | URL |
|---|---|
| API Gateway | http://localhost:8080 |
| Swagger UI | http://localhost:8080/api-docs |
| OpenAPI JSON | http://localhost:8080/api-docs.json |
| Map UI | http://localhost:8080/map |
| Health | http://localhost:8080/health |
| User Service | http://localhost:4001/health |
| Vehicle Service | http://localhost:4002/health |
| Telemetry Service | http://localhost:4003/health |
| Geolocation Service | http://localhost:4004/health |
| Notification Service | http://localhost:4005/health |

### Sample API keys and seeded logins

| API key | Tier | Limit |
|---|---|---|
| `devkey123` | standard | 100 requests / 15 min |
| `partnerkey456` | premium | 1000 requests / 15 min |
| `demokey789` | demo | 5 requests / 15 min (for showing a 429) |

| Role | Email | Password | Phone |
|---|---|---|---|
| admin | admin@fleet.local | Admin@123 | +919847000001 |
| fleet_manager | manager@fleet.local | Manager@123 | +919847000002 |
| driver | driver@fleet.local | Driver@123 | +919847000003 |
| driver (SMS always fails) | driver2@fleet.local | Driver@123 | +919800000000 |

## API Gateway

| Gateway route | Target service |
|---|---|
| `/api/users/*` | User Service |
| `/api/vehicles/*` | Vehicle/Fleet Service |
| `/api/telemetry/*` | Telemetry Service |
| `/api/maps/*` | Geolocation Service |
| `/api/notifications/*` | Notification Service |

- **API key:** every `/api/*` request needs `x-api-key`. A missing key returns `401 API_KEY_MISSING` and a wrong one returns `403 API_KEY_INVALID`. `/health`, `/api-docs` and `/map` are exempt.
- **Rate limiting:** counted per API key, with limits by tier. Every response carries `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset`. Going over the limit returns `429 RATE_LIMIT_EXCEEDED` with `Retry-After`.
- **Forwarding:** the request body, `Authorization` header and responses pass through unchanged. The gateway adds `x-request-id` (or keeps the client's) and `x-forwarded-by: fleet-gateway`, and strips `x-api-key` and `x-internal-token`. Responses include `x-served-by` and `x-developed-by`.
- **Errors:** a service that is down or times out returns `503 SERVICE_UNAVAILABLE`, naming the service. An unknown route returns `404 ROUTE_NOT_FOUND`, malformed JSON returns `400 INVALID_REQUEST`, and a body over 100 kb returns `413 PAYLOAD_TOO_LARGE`. Internal `/…/internal/…` routes are blocked.
- Every error uses the same shape: `{ "error": { "code", "message", "details" } }`.

## Endpoint summary

| Method & path | Roles | Description |
|---|---|---|
| `POST /api/users/register` | public (driver) / admin | Register a user |
| `POST /api/users/login` | public | Log in and get a JWT (`sub`, `role`, `exp`) |
| `GET /api/users/me` | any | Current profile |
| `GET /api/users/verify` | any | Validate a token and return its claims |
| `GET /api/users` | admin | List users |
| `GET /api/users/:id` | admin, fleet_manager, self | Get a user |
| `POST /api/vehicles` | admin, fleet_manager | Register a vehicle (an `address` is geocoded) |
| `GET /api/vehicles` | any | List vehicles (filters, pagination) |
| `GET /api/vehicles/nearby?lat&lng&radiusKm` | any | Vehicles within X km, sorted, with `distanceKm` |
| `GET /api/vehicles/:id` | any | Vehicle with status history |
| `PUT /api/vehicles/:id` | admin, fleet_manager | Update a vehicle |
| `PATCH /api/vehicles/:id/status` | admin, fleet_manager, assigned driver | Change status and SMS admins, managers and the driver |
| `DELETE /api/vehicles/:id` | **admin only** | Delete (others get 403, no token gets 401) |
| `POST /api/telemetry` | any | GPS/sensor reading; a critical event sends SMS to admins |
| `GET /api/telemetry/:vehicleId` | any | Paginated history |
| `GET /api/telemetry/:vehicleId/latest` | any | Latest reading |
| `GET /api/maps/geocode?address` | any | Address to lat/lng (cached) |
| `GET /api/maps/reverse?lat&lng` | any | Lat/lng to address |
| `GET /api/maps/nearby` | any | Nearby vehicles by coordinates or address |
| `GET /api/maps/distance?from&to` | any | Haversine distance |
| `POST /api/notifications/sms` | admin | Send one SMS |
| `POST /api/notifications/notify` | admin, fleet_manager | SMS a group of users by role |
| `GET /api/notifications` | admin, fleet_manager | List (filter by status/type/vehicle) |
| `GET /api/notifications/stats` | admin, fleet_manager | Sent and failed counts |
| `GET /api/notifications/:id` | admin, fleet_manager | One notification |

Full request/response models, examples and error codes are in **Swagger UI** at `/api-docs`. Click **Authorize**, enter `devkey123` for `ApiKeyAuth`, then paste the login token into `BearerAuth`.

## Third-party integrations

**Geolocation:** the default is OpenStreetMap **Nominatim** (no API key needed). Results are cached in MongoDB for 30 days, requests are throttled to 1 per second, and each request sends an identifying `User-Agent`. To use **Google Maps**, set `GEO_PROVIDER=google` and `GOOGLE_MAPS_API_KEY=<key>`. `GEO_PROVIDER=mock` is an offline geocoder used by the tests. `GEO_FALLBACK_PROVIDER=mock` adds a safety net: if the primary provider fails (for example Nominatim answering **429** to a shared cloud IP, as happens on Render), the request is answered by the fallback, and the response says so with `fallbackFrom` and `fallbackReason`. Fallback answers are not cached, so the real provider is tried again next time. The Render deployment uses this setting.

**SMS:** the default `stub` provider prints a formatted "📱 SMS SENT" box in the notification-service console and stores the record. Numbers ending in `0000` always fail, and `SMS_STUB_FAIL_RATE` (0–1) adds random failures. Each SMS is retried once, then marked `sent` or `failed`. To use the **Twilio sandbox**, set `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER`. On a trial account, Twilio only delivers to verified numbers.

**Critical events:** an explicit `eventType` of `ENGINE_FAULT`, `LOW_BATTERY` or `EMERGENCY_STOP`, or a reading past the thresholds (battery < `LOW_BATTERY_VOLTAGE` = 11.5 V, engine > `ENGINE_TEMP_MAX` = 110 °C), sends an SMS to every admin.

## Tests

```bash
npm test                 # all 150 tests (spec output + HTML report in test-report/index.html)
npm run test:coverage    # same with c8 coverage (coverage/index.html)
npm run test:auth        # per flow: test:auth, test:vehicles, test:telemetry, test:status,
                         # test:rbac, test:nearby, test:gateway, test:docs, test:providers
```

The tests run fully offline and give the same result every run. They use an in-memory MongoDB, start every service on a random port so real service-to-service calls are exercised, and mock Nominatim, Google and Twilio with `nock` and `sinon`. Fake upstream services are used for the gateway tests.

| # | Flow from the brief | File |
|---|---|---|
| 1 | User login and JWT token verification | `test/flows/01-auth.flow.js` |
| 2 | Vehicle registration and retrieval | `test/flows/02-vehicles.flow.js` |
| 3 | Telemetry submission and storage | `test/flows/03-telemetry.flow.js` |
| 4 | Status update and notification triggering | `test/flows/04-status-notifications.flow.js` |
| 5 | Role-based access control (delete vehicle) | `test/flows/05-rbac.flow.js` |
| 6 | Nearby search with mocked geolocation | `test/flows/06-nearby.flow.js` |
| 7 | Gateway API key verification and rate limiting | `test/flows/07-gateway.flow.js` |
| + | Swagger spec coverage, provider adapters | `08-swagger-docs.flow.js`, `09-providers.flow.js` |

Latest local run: **150 passing**. Coverage: about 98% of lines and 87% of branches.

## Deployment (Render + MongoDB Atlas)

1. **MongoDB Atlas:** create a free M0 cluster and a database user, allow network access from `0.0.0.0/0`, and copy the `mongodb+srv://…` connection string.
2. **Render (recommended: one free web service):** use New → Blueprint with this repo (it reads `render.yaml`), or create a Web Service by hand:
   - Build command: `npm ci --omit=dev`
   - Start command: `npm run start:all` (all 5 services plus the gateway in one process; the gateway listens on Render's `PORT`)
   - Environment variables: `MONGO_URI`, `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN`, `API_KEYS`, `TRUST_PROXY=1`, `NODE_VERSION=20`, `MONGOMS_DISABLE_POSTINSTALL=1`
3. **Separate services (optional):** deploy each service with `node services/<name>/src/server.js` and the gateway with `node gateway/src/server.js`. Set `USER_SERVICE_URL`, `VEHICLE_SERVICE_URL`, `TELEMETRY_SERVICE_URL`, `GEO_SERVICE_URL` and `NOTIFICATION_SERVICE_URL` on every service to the Render URLs.
4. Free Render services sleep when idle, so the first request can take about 50 s.

5. Nominatim often answers **429** to Render's shared outbound IPs, so `render.yaml` sets `GEO_FALLBACK_PROVIDER=mock`. Geocoding responses on the live site may show `"provider": "mock", "fallbackFrom": "nominatim"`; locally they come from Nominatim.
6. Load the demo data into Atlas from your machine: `MONGO_URI="<atlas string>" npm run seed`.

**Deployed link:** [https://fleet-management-system-au8x.onrender.com/map](https://fleet-management-system-au8x.onrender.com/map): services on Render (free plan), data in MongoDB Atlas (M0).

## Design decisions and assumptions

- **One codebase, five services:** npm workspaces share middleware through `@fleet/shared`. Each service exports its Express `app` separately from `listen()`, so the tests and `start:all` can import it.
- **Database per service:** each service has its own logical MongoDB database on one cluster. The services stay independent while the setup stays free.
- **GeoJSON + `2dsphere` + `$geoNear`:** MongoDB filters by radius and sorts by distance in a single query. Haversine distances use MongoDB's Earth radius (6378.1 km), so `/maps/distance` and `distanceKm` always agree.
- **Notification failures never undo business actions:** a status change or telemetry reading is saved even if the SMS fails, and the failure is recorded on the response and the notification record.
- **Self-registration is driver-only:** creating an admin or fleet_manager needs an admin JWT.
- **Drivers** may change the status of their own assigned vehicle only.
- **Gateway body parsing:** the gateway parses JSON so it can return 400/413 itself, then re-streams the body to the target (`fixRequestBody`).
- **Rate limit store** is in memory for each gateway instance. A shared store such as Redis would be needed with several gateway instances.
- **Zero-setup dev:** with no `MONGO_URI`, a persistent local MongoDB (`mongodb-memory-server`) starts on port 27018.

## Screenshots

<details open>
<summary>24 screenshots from the walkthrough (click to collapse)</summary>

**01. Gateway `/health`: all 5 services up**

![Gateway `/health`: all 5 services up](screenshots/01-health-check.png)

**02. Seeding and starting the gateway and services**

![Seeding and starting the gateway and services](screenshots/02-gateway-banner.png)

**03. Swagger UI overview**

![Swagger UI overview](screenshots/03-swagger-overview.png)

**04. Swagger: API key and JWT authorisation**

![Swagger: API key and JWT authorisation](screenshots/04-swagger-authorize.png)

**04b. Swagger: documented endpoint and responses**

![Swagger: documented endpoint and responses](screenshots/04b-swagger-endpoint.png)

**04c. Swagger: Try it out**

![Swagger: Try it out](screenshots/04c-swagger-try-it-out.png)

**04d. Login through the gateway → JWT**

![Login through the gateway → JWT](screenshots/04d-login-jwt.png)

**05. Vehicle registered by address, geocoded by Nominatim**

![Vehicle registered by address, geocoded by Nominatim](screenshots/05-register-vehicle-geocoded.png)

**06. GPS telemetry stored, vehicle location updated**

![GPS telemetry stored, vehicle location updated](screenshots/06-telemetry.png)

**07. Nearby search with `$geoNear`, sorted by distance**

![Nearby search with `$geoNear`, sorted by distance](screenshots/07-nearby-search.png)

**08. Live map: OSM tiles, markers and nearby circle**

![Live map: OSM tiles, markers and nearby circle](screenshots/08-map-nearby.png)

**09. Critical event: low battery detected**

![Critical event: low battery detected](screenshots/09-critical-event.png)

**10. SMS alert sent to the admin (stub provider)**

![SMS alert sent to the admin (stub provider)](screenshots/10-sms-console.png)

**11. Status change → SMS to admins, manager and driver, with retry and failure**

![Status change → SMS to admins, manager and driver, with retry and failure](screenshots/11-status-change-sms.png)

**12. Notification records**

![Notification records](screenshots/12-notifications.png)

**12b. Failed notifications and stats**

![Failed notifications and stats](screenshots/12b-notifications.png)

**13. Gateway: missing key 401, wrong key 403**

![Gateway: missing key 401, wrong key 403](screenshots/13-api-key-401-403.png)

**14. Gateway routing headers (`x-request-id`, `x-served-by`)**

![Gateway routing headers (`x-request-id`, `x-served-by`)](screenshots/14-routing-headers.png)

**15. Rate limiting: 5 × 200, then 429 with `Retry-After`**

![Rate limiting: 5 × 200, then 429 with `Retry-After`](screenshots/15-rate-limit-429.png)

**16. Service down → 503 `SERVICE_UNAVAILABLE`**

![Service down → 503 `SERVICE_UNAVAILABLE`](screenshots/16-service-down-503.png)

**17. Mocha/Chai test run**

![Mocha/Chai test run](screenshots/17-npm-test.png)

**18. Mochawesome HTML test report**

![Mochawesome HTML test report](screenshots/18-test-report.png)

**19. c8 coverage report**

![c8 coverage report](screenshots/19-coverage.png)

**20. Deployed on Render (Live)**

![Deployed on Render (Live)](screenshots/20-render-deployed.png)

</details>

## Author

**Ashfaaq Feroz Muhammad** · BITS ID **2023EBCS005** · Backend and API Development – BITS Pilani
Licensed under the [MIT License](LICENSE).
