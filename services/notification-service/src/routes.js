/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/notification-service/src/routes.js – send SMS, notify groups, list/inspect notifications, stats
 */
const express = require('express');
const {
  ApiError,
  Joi,
  validate,
  phone,
  objectId,
  asyncHandler,
  authenticateOrInternal,
  requireRole,
} = require('@fleet/shared');
const Notification = require('./models/Notification');
const { sendSms, notifyRecipients } = require('./notifier');

const { TYPES, STATUSES } = Notification;
const router = express.Router();
router.use(authenticateOrInternal);

const smsSchema = Joi.object({
  to: phone().required(),
  message: Joi.string().trim().min(1).max(1000).required(),
  type: Joi.string().valid(...TYPES).default('MANUAL'),
  vehicleId: Joi.string().max(64),
  event: Joi.string().max(64),
});

const notifySchema = Joi.object({
  type: Joi.string().valid(...TYPES).required(),
  message: Joi.string().trim().min(1).max(1000).required(),
  vehicleId: Joi.string().max(64),
  event: Joi.string().max(64),
  recipients: Joi.object({
    roles: Joi.array().items(Joi.string().valid('admin', 'fleet_manager', 'driver')).default([]),
    userIds: Joi.array().items(Joi.string().allow(null, '')).default([]),
    phones: Joi.array().items(phone()).default([]),
  })
    .or('roles', 'userIds', 'phones')
    .required(),
});

const listQuery = Joi.object({
  status: Joi.string().valid(...STATUSES),
  type: Joi.string().valid(...TYPES),
  vehicleId: Joi.string().max(64),
  to: Joi.string().max(20),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

/** POST /notifications/sms – send one SMS (internal services or admin). 201 even if delivery failed: the record is created. */
router.post(
  '/sms',
  requireRole('admin'),
  validate(smsSchema),
  asyncHandler(async (req, res) => {
    const notification = await sendSms(req.body);
    res.status(201).json({ notification });
  })
);

/** POST /notifications/notify – SMS every user matching roles / user ids (internal, admin, fleet_manager). */
router.post(
  '/notify',
  requireRole('admin', 'fleet_manager'),
  validate(notifySchema),
  asyncHandler(async (req, res) => {
    const results = await notifyRecipients({ ...req.body, requestId: req.headers['x-request-id'] });
    res.status(201).json({
      count: results.length,
      sent: results.filter((n) => n.status === 'sent').length,
      failed: results.filter((n) => n.status === 'failed').length,
      data: results,
    });
  })
);

/** GET /notifications/stats – counts by status and by type. */
router.get(
  '/stats',
  requireRole('admin', 'fleet_manager'),
  asyncHandler(async (_req, res) => {
    const [byStatus, byType] = await Promise.all([
      Notification.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Notification.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
    ]);
    const toMap = (rows, keys) => Object.fromEntries(keys.map((k) => [k, (rows.find((r) => r._id === k) || {}).count || 0]));
    const status = toMap(byStatus, STATUSES);
    res.json({
      total: status.queued + status.sent + status.failed,
      ...status,
      byType: toMap(byType, TYPES),
    });
  })
);

/** GET /notifications?status=&type=&vehicleId=&page=&limit= */
router.get(
  '/',
  requireRole('admin', 'fleet_manager'),
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit, ...filters } = req.query;
    const filter = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined));
    const [data, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Notification.countDocuments(filter),
    ]);
    res.json({ data, page, limit, total, totalPages: Math.ceil(total / limit) });
  })
);

/** GET /notifications/:id */
router.get(
  '/:id',
  requireRole('admin', 'fleet_manager'),
  validate(Joi.object({ id: objectId().required() }), 'params'),
  asyncHandler(async (req, res) => {
    const notification = await Notification.findById(req.params.id);
    if (!notification) throw ApiError.notFound('NOTIFICATION_NOT_FOUND', `Notification ${req.params.id} not found`);
    res.json({ notification });
  })
);

module.exports = router;
