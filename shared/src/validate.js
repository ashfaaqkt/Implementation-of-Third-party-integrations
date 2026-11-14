/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : shared/src/validate.js – Joi validation middleware for body / query / params
 */
const Joi = require('joi');
const ApiError = require('./ApiError');

/**
 * validate(schema, 'body' | 'query' | 'params')
 * On success the sanitised value replaces req[source]; on failure → 400 VALIDATION_ERROR
 * with one { field, message } entry per problem.
 */
function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const { value, error } = schema.validate(req[source] ?? {}, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      return next(
        ApiError.validation(
          error.details.map((d) => ({ field: d.path.join('.'), message: d.message.replace(/"/g, "'") }))
        )
      );
    }
    req[source] = value;
    return next();
  };
}

const objectId = () => Joi.string().hex().length(24);
const latitude = () => Joi.number().min(-90).max(90);
const longitude = () => Joi.number().min(-180).max(180);
/** E.164 phone format, e.g. +919876543210 */
const phone = () =>
  Joi.string()
    .pattern(/^\+[1-9]\d{7,14}$/)
    .message('phone must be in E.164 format, e.g. +919876543210');

module.exports = { validate, Joi, objectId, latitude, longitude, phone };
