/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : gateway/src/docs/paths/gateway.docs.js – OpenAPI annotations for gateway endpoints
 */

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Gateway]
 *     summary: Gateway and downstream service health
 *     description: |
 *       Public – no API key needed. Pings every backend service's `/health`
 *       and reports `ok` when all are up, `degraded` otherwise.
 *     x-roles: [public]
 *     security: []
 *     responses:
 *       200:
 *         description: Health report
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GatewayHealth'
 * /:
 *   get:
 *     tags: [Gateway]
 *     summary: Gateway information and route table
 *     x-roles: [public]
 *     security: []
 *     responses:
 *       200:
 *         description: Project info, author, links and routes
 *         content:
 *           application/json:
 *             example:
 *               project: Fleet Management System – Third-party Integrations, API Gateway
 *               author: Ashfaaq Feroz Muhammad
 *               bitsId: 2023EBCS005
 *               links: { health: /health, docs: /api-docs, openapi: /api-docs.json, map: /map }
 *               routes:
 *                 - { route: /api/users/*, service: user-service }
 *                 - { route: /api/vehicles/*, service: vehicle-service }
 * /api/{unknown}:
 *   get:
 *     tags: [Gateway]
 *     summary: Unknown routes return 404 ROUTE_NOT_FOUND
 *     description: Any path that does not match a gateway route (including `/internal/` service-to-service routes) returns 404.
 *     x-roles: [any]
 *     parameters:
 *       - name: unknown
 *         in: path
 *         required: true
 *         schema: { type: string, example: does-not-exist }
 *     responses:
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404:
 *         description: Route not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *             example: { error: { code: ROUTE_NOT_FOUND, message: 'Route GET /api/does-not-exist not found' } }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 */
module.exports = {};
