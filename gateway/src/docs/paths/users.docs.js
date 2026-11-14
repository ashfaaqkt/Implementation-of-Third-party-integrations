/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : gateway/src/docs/paths/users.docs.js – OpenAPI annotations for /api/users/*
 */

/**
 * @openapi
 * /api/users/register:
 *   post:
 *     tags: [Users]
 *     summary: Register a user
 *     description: |
 *       **Roles:** public for `driver` accounts. Creating an `admin` or `fleet_manager`
 *       account requires an **admin** JWT (otherwise 403 INSUFFICIENT_ROLE).
 *     x-roles: [public, admin]
 *     security:
 *       - ApiKeyAuth: []
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RegisterRequest' }
 *           examples:
 *             driver:
 *               summary: Self-register a driver
 *               value: { name: Dev Driver, email: dev.driver@fleet.local, phone: '+919847000077', password: Driver@123 }
 *             manager:
 *               summary: Admin creates a fleet manager
 *               value: { name: New Manager, email: new.manager@fleet.local, phone: '+919847000078', password: Manager@123, role: fleet_manager }
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 * /api/users/login:
 *   post:
 *     tags: [Users]
 *     summary: Log in and receive a JWT
 *     description: |
 *       **Roles:** public. Returns a JWT whose claims are `sub` (user id), `role`, `name`, `email`, `iat`, `exp`.
 *       Click **Authorize → BearerAuth** and paste the `token` to call protected endpoints.
 *     x-roles: [public]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginRequest' }
 *           examples:
 *             admin: { summary: Seeded admin, value: { email: admin@fleet.local, password: Admin@123 } }
 *             manager: { summary: Seeded fleet manager, value: { email: manager@fleet.local, password: Manager@123 } }
 *             driver: { summary: Seeded driver, value: { email: driver@fleet.local, password: Driver@123 } }
 *     responses:
 *       200:
 *         description: Logged in
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401:
 *         description: Wrong email/password (INVALID_CREDENTIALS) or missing API key
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *             example: { error: { code: INVALID_CREDENTIALS, message: Invalid email or password } }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 * /api/users/me:
 *   get:
 *     tags: [Users]
 *     summary: Current user's profile
 *     description: "**Roles:** admin, fleet_manager, driver (any valid JWT)."
 *     x-roles: [admin, fleet_manager, driver]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 * /api/users/verify:
 *   get:
 *     tags: [Users]
 *     summary: Verify a JWT and return its claims
 *     description: "**Roles:** any valid JWT. Tampered → 401 TOKEN_INVALID, expired → 401 TOKEN_EXPIRED."
 *     x-roles: [admin, fleet_manager, driver]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TokenVerification' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List all users
 *     description: "**Roles:** admin only."
 *     x-roles: [admin]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - name: role
 *         in: query
 *         schema: { type: string, enum: [admin, fleet_manager, driver] }
 *     responses:
 *       200:
 *         description: Users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: array, items: { $ref: '#/components/schemas/User' } }
 *                 total: { type: integer, example: 4 }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get a user by id
 *     description: "**Roles:** admin, fleet_manager, or the user themself."
 *     x-roles: [admin, fleet_manager, self]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, pattern: '^[a-f0-9]{24}$' }
 *     responses:
 *       200:
 *         description: User
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 */
module.exports = {};
