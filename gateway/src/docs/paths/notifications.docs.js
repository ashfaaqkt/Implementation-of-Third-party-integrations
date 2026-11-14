/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : gateway/src/docs/paths/notifications.docs.js – OpenAPI annotations for /api/notifications/*
 */

/**
 * @openapi
 * /api/notifications/sms:
 *   post:
 *     tags: [Notifications]
 *     summary: Send one SMS
 *     description: |
 *       **Roles:** admin (and internal services).
 *       Every attempt is stored as a Notification. On failure the provider is retried
 *       once, then the record is marked `failed`. With the stub provider, numbers
 *       ending in `0000` always fail – handy for demonstrating the failure path.
 *       Returns 201 in both cases because a record was created; check `status`.
 *     x-roles: [admin, internal]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SmsRequest' }
 *           examples:
 *             success: { summary: Delivered, value: { to: '+919847000001', message: 'Test SMS from the Fleet Management System' } }
 *             failure: { summary: Always fails (ends in 0000), value: { to: '+919800000000', message: 'This one will fail' } }
 *     responses:
 *       201:
 *         description: Notification record (sent or failed)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notification: { $ref: '#/components/schemas/Notification' }
 *             examples:
 *               sent: { value: { notification: { to: '+919847000001', type: MANUAL, provider: stub, status: sent, attempts: 1, providerMessageId: stub-5b0f0c8e } } }
 *               failed: { value: { notification: { to: '+919800000000', type: MANUAL, provider: stub, status: failed, attempts: 2, error: 'Simulated carrier rejection (numbers ending in 0000 always fail)' } } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 * /api/notifications/notify:
 *   post:
 *     tags: [Notifications]
 *     summary: SMS a group of users (by role / user id / phone)
 *     description: |
 *       **Roles:** admin, fleet_manager (and internal services – this is what the
 *       Vehicle and Telemetry services call for status changes and critical events).
 *     x-roles: [admin, fleet_manager, internal]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/NotifyRequest' }
 *           example: { type: MANUAL, message: 'Depot closes early today at 6 PM.', recipients: { roles: [fleet_manager, driver] } }
 *     responses:
 *       201:
 *         description: One record per recipient
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/NotifyResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List notifications (filter by status / type / vehicle)
 *     description: "**Roles:** admin, fleet_manager."
 *     x-roles: [admin, fleet_manager]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - { name: status, in: query, schema: { type: string, enum: [queued, sent, failed] } }
 *       - { name: type, in: query, schema: { type: string, enum: [CRITICAL_EVENT, STATUS_CHANGE, MANUAL] } }
 *       - { name: vehicleId, in: query, schema: { type: string } }
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/Limit'
 *     responses:
 *       200:
 *         description: Notifications, newest first
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/NotificationList' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 * /api/notifications/stats:
 *   get:
 *     tags: [Notifications]
 *     summary: Count of sent / failed notifications
 *     description: "**Roles:** admin, fleet_manager."
 *     x-roles: [admin, fleet_manager]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     responses:
 *       200:
 *         description: Stats
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/NotificationStats' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 * /api/notifications/{id}:
 *   get:
 *     tags: [Notifications]
 *     summary: Get one notification
 *     description: "**Roles:** admin, fleet_manager."
 *     x-roles: [admin, fleet_manager]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, pattern: '^[a-f0-9]{24}$' } }
 *     responses:
 *       200:
 *         description: Notification
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notification: { $ref: '#/components/schemas/Notification' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 */
module.exports = {};
