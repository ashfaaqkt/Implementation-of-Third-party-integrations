/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/user-service/src/routes.js – register, login, profile, user list, token verification
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const {
  ApiError,
  ROLES,
  Joi,
  validate,
  phone,
  objectId,
  asyncHandler,
  authenticate,
  internalOnly,
  requireRole,
  signToken,
  verifyToken,
  config,
} = require('@fleet/shared');
const User = require('./models/User');

const router = express.Router();

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().email({ tlds: { allow: false } }).required(),
  phone: phone().required(),
  password: Joi.string().min(8).max(128).required(),
  role: Joi.string().valid(...ROLES).default('driver'),
});

const loginSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).required(),
  password: Joi.string().required(),
});

const contactsQuery = Joi.object({
  roles: Joi.string().allow('').default(''),
  ids: Joi.string().allow('').default(''),
});

/** If a Bearer token is present, decode it (used to let admins create privileged users). */
function optionalUser(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    return verifyToken(header.slice(7));
  } catch {
    return null;
  }
}

/**
 * POST /users/register
 * Anyone can self-register as a driver. Creating an admin or fleet_manager
 * requires an admin JWT – otherwise anyone could make themselves admin.
 */
router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, phone: phoneNumber, password, role } = req.body;
    if (role !== 'driver') {
      const caller = optionalUser(req);
      if (!caller || caller.role !== 'admin') {
        throw ApiError.forbidden(`Only an admin can create a '${role}' account`, 'INSUFFICIENT_ROLE');
      }
    }
    if (await User.exists({ email: email.toLowerCase() })) {
      throw ApiError.conflict('EMAIL_ALREADY_REGISTERED', `A user with email ${email} already exists`);
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, phone: phoneNumber, passwordHash, role });
    res.status(201).json({ user });
  })
);

/** POST /users/login → { token, tokenType, expiresIn, user } */
router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+passwordHash');
    const ok = user && (await bcrypt.compare(req.body.password, user.passwordHash));
    if (!ok) throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    res.json({ token: signToken(user), tokenType: 'Bearer', expiresIn: config.jwtExpiresIn(), user });
  })
);

/** GET /users/me – the logged-in user's profile */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) throw ApiError.notFound('USER_NOT_FOUND', 'User for this token no longer exists');
    res.json({ user });
  })
);

/** GET /users/verify – validates a token and returns its claims (useful for other services) */
router.get('/verify', authenticate, (req, res) => {
  const { sub, role, name, email, iat, exp } = req.token;
  res.json({ valid: true, claims: { sub, role, name, email, iat, exp }, expiresAt: new Date(exp * 1000).toISOString() });
});

/**
 * GET /users/internal/contacts?roles=admin,fleet_manager&ids=<id>,<id>
 * Service-to-service only: phone numbers used by the Notification Service.
 */
router.get(
  '/internal/contacts',
  internalOnly,
  validate(contactsQuery, 'query'),
  asyncHandler(async (req, res) => {
    const roles = req.query.roles.split(',').map((s) => s.trim()).filter((r) => ROLES.includes(r));
    const ids = req.query.ids.split(',').map((s) => s.trim()).filter((id) => /^[a-f0-9]{24}$/i.test(id));
    const or = [];
    if (roles.length) or.push({ role: { $in: roles } });
    if (ids.length) or.push({ _id: { $in: ids } });
    const users = or.length ? await User.find({ $or: or }) : [];
    res.json({ data: users.map((u) => ({ id: String(u._id), name: u.name, phone: u.phone, role: u.role })) });
  })
);

/** GET /users – admin only */
router.get(
  '/',
  authenticate,
  requireRole('admin'),
  validate(Joi.object({ role: Joi.string().valid(...ROLES) }), 'query'),
  asyncHandler(async (req, res) => {
    const filter = req.query.role ? { role: req.query.role } : {};
    const users = await User.find(filter).sort({ createdAt: 1 });
    res.json({ data: users, total: users.length });
  })
);

/** GET /users/:id – admin, fleet_manager, or the user themself */
router.get(
  '/:id',
  authenticate,
  validate(Joi.object({ id: objectId().required() }), 'params'),
  asyncHandler(async (req, res) => {
    const self = req.user.id === req.params.id;
    if (!self && !['admin', 'fleet_manager'].includes(req.user.role)) {
      throw ApiError.forbidden('You can only view your own profile', 'INSUFFICIENT_ROLE');
    }
    const user = await User.findById(req.params.id);
    if (!user) throw ApiError.notFound('USER_NOT_FOUND', `User ${req.params.id} not found`);
    res.json({ user });
  })
);

module.exports = router;
