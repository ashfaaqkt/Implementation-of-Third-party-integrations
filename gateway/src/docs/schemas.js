/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : gateway/src/docs/schemas.js – reusable OpenAPI request/response models
 */
const id = (example) => ({ type: 'string', pattern: '^[a-f0-9]{24}$', example });
const ts = { type: 'string', format: 'date-time', example: '2026-11-14T10:30:00.000Z' };
const ROLES = ['admin', 'fleet_manager', 'driver'];
const VEHICLE_STATUSES = ['active', 'idle', 'maintenance', 'offline', 'emergency'];
const NOTIFICATION_TYPES = ['CRITICAL_EVENT', 'STATUS_CHANGE', 'MANUAL'];

const paginated = (ref) => ({
  type: 'object',
  properties: {
    data: { type: 'array', items: { $ref: `#/components/schemas/${ref}` } },
    page: { type: 'integer', example: 1 },
    limit: { type: 'integer', example: 20 },
    total: { type: 'integer', example: 1 },
    totalPages: { type: 'integer', example: 1 },
  },
});

module.exports = {
  Error: {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'string', example: 'VEHICLE_NOT_FOUND' },
          message: { type: 'string', example: 'Vehicle 665f1c2e8b3a4d0012345678 not found' },
          details: { description: 'Optional extra information (validation errors, service name, ...)', oneOf: [{ type: 'array', items: { type: 'object' } }, { type: 'object' }] },
        },
      },
    },
  },

  // ------------------------------------------------------------- users
  User: {
    type: 'object',
    properties: {
      id: id('665f1a0b8b3a4d0012340001'),
      name: { type: 'string', example: 'Asha Admin' },
      email: { type: 'string', format: 'email', example: 'admin@fleet.local' },
      phone: { type: 'string', example: '+919847000001', description: 'E.164 format' },
      role: { type: 'string', enum: ROLES, example: 'admin' },
      createdAt: ts,
      updatedAt: ts,
    },
  },
  RegisterRequest: {
    type: 'object',
    required: ['name', 'email', 'phone', 'password'],
    properties: {
      name: { type: 'string', minLength: 2, example: 'Dev Driver' },
      email: { type: 'string', format: 'email', example: 'dev.driver@fleet.local' },
      phone: { type: 'string', pattern: '^\\+[1-9]\\d{7,14}$', example: '+919847000077' },
      password: { type: 'string', format: 'password', minLength: 8, example: 'Driver@123' },
      role: { type: 'string', enum: ROLES, default: 'driver', description: 'Only an admin (JWT) may create admin / fleet_manager accounts' },
    },
  },
  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', example: 'admin@fleet.local' },
      password: { type: 'string', format: 'password', example: 'Admin@123' },
    },
  },
  AuthResponse: {
    type: 'object',
    properties: {
      token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NjVmMWEwYjhiM2E0ZDAwMTIzNDAwMDEiLCJyb2xlIjoiYWRtaW4ifQ.sig' },
      tokenType: { type: 'string', example: 'Bearer' },
      expiresIn: { type: 'string', example: '1h' },
      user: { $ref: '#/components/schemas/User' },
    },
  },
  TokenVerification: {
    type: 'object',
    properties: {
      valid: { type: 'boolean', example: true },
      claims: {
        type: 'object',
        properties: {
          sub: id('665f1a0b8b3a4d0012340001'),
          role: { type: 'string', enum: ROLES, example: 'admin' },
          name: { type: 'string', example: 'Asha Admin' },
          email: { type: 'string', example: 'admin@fleet.local' },
          iat: { type: 'integer', example: 1794652200 },
          exp: { type: 'integer', example: 1794655800 },
        },
      },
      expiresAt: ts,
    },
  },

  // ------------------------------------------------------------- vehicles
  LatLng: {
    type: 'object',
    required: ['lat', 'lng'],
    properties: {
      lat: { type: 'number', minimum: -90, maximum: 90, example: 9.9658 },
      lng: { type: 'number', minimum: -180, maximum: 180, example: 76.2856 },
    },
  },
  GeoPoint: {
    type: 'object',
    description: 'GeoJSON Point – note the [longitude, latitude] order',
    properties: {
      type: { type: 'string', enum: ['Point'], example: 'Point' },
      coordinates: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2, example: [76.2856, 9.9658] },
    },
  },
  StatusHistoryEntry: {
    type: 'object',
    properties: {
      from: { type: 'string', nullable: true, enum: [...VEHICLE_STATUSES, null], example: 'active' },
      to: { type: 'string', enum: VEHICLE_STATUSES, example: 'maintenance' },
      reason: { type: 'string', example: 'Scheduled service' },
      changedBy: { type: 'object', properties: { id: { type: 'string' }, role: { type: 'string' }, name: { type: 'string' } } },
      changedAt: ts,
    },
  },
  Vehicle: {
    type: 'object',
    properties: {
      id: id('665f1c2e8b3a4d0012345678'),
      registrationNumber: { type: 'string', example: 'KL-07-AB-1234' },
      make: { type: 'string', example: 'Tata' },
      model: { type: 'string', example: 'Ace Gold' },
      type: { type: 'string', enum: ['truck', 'van', 'car', 'bus', 'bike', 'other'], example: 'truck' },
      driverId: { type: 'string', nullable: true, example: '665f1a0b8b3a4d0012340003' },
      address: { type: 'string', nullable: true, example: 'MG Road, Kochi' },
      location: { $ref: '#/components/schemas/GeoPoint' },
      position: { $ref: '#/components/schemas/LatLng' },
      locationSource: { type: 'string', enum: ['gps', 'geocoded', 'manual'], example: 'geocoded' },
      lastLocationAt: ts,
      status: { type: 'string', enum: VEHICLE_STATUSES, example: 'active' },
      statusHistory: { type: 'array', items: { $ref: '#/components/schemas/StatusHistoryEntry' } },
      createdAt: ts,
      updatedAt: ts,
    },
  },
  VehicleInput: {
    type: 'object',
    required: ['registrationNumber', 'make', 'model'],
    description: 'Give either `location` (coordinates) or `address` (geocoded by the Geolocation Service).',
    properties: {
      registrationNumber: { type: 'string', example: 'KL-07-AB-1234' },
      make: { type: 'string', example: 'Tata' },
      model: { type: 'string', example: 'Ace Gold' },
      type: { type: 'string', enum: ['truck', 'van', 'car', 'bus', 'bike', 'other'], default: 'truck' },
      driverId: { type: 'string', nullable: true, pattern: '^[a-f0-9]{24}$' },
      address: { type: 'string', example: 'MG Road, Kochi' },
      location: { $ref: '#/components/schemas/LatLng' },
    },
  },
  VehicleUpdate: {
    type: 'object',
    minProperties: 1,
    properties: {
      make: { type: 'string', example: 'Tata' },
      model: { type: 'string', example: 'Ultra T.7' },
      type: { type: 'string', enum: ['truck', 'van', 'car', 'bus', 'bike', 'other'] },
      driverId: { type: 'string', nullable: true },
      address: { type: 'string', example: 'Kakkanad, Kochi' },
      location: { $ref: '#/components/schemas/LatLng' },
    },
  },
  GeocodingInfo: {
    type: 'object',
    description: 'Outcome of geocoding the `address` (only present when an address or location was given)',
    properties: {
      status: { type: 'string', enum: ['success', 'failed', 'skipped'], example: 'success' },
      lat: { type: 'number', example: 9.9658 },
      lng: { type: 'number', example: 76.2856 },
      displayName: { type: 'string', example: 'MG Road, Ernakulam, Kochi, Kerala, India' },
      provider: { type: 'string', example: 'nominatim' },
      cached: { type: 'boolean', example: false },
      reason: { type: 'string' },
    },
  },
  VehicleResponse: {
    type: 'object',
    properties: { vehicle: { $ref: '#/components/schemas/Vehicle' }, geocoding: { $ref: '#/components/schemas/GeocodingInfo' } },
  },
  VehicleList: paginated('Vehicle'),
  StatusUpdate: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', enum: VEHICLE_STATUSES, example: 'maintenance' },
      reason: { type: 'string', example: 'Brake inspection' },
    },
  },
  StatusUpdateResponse: {
    type: 'object',
    properties: {
      vehicle: { $ref: '#/components/schemas/Vehicle' },
      changed: { type: 'boolean', example: true },
      previousStatus: { type: 'string', example: 'active' },
      notifications: {
        type: 'object',
        description: 'SMS sent to admins, fleet managers and the assigned driver',
        properties: {
          count: { type: 'integer', example: 3 },
          sent: { type: 'integer', example: 3 },
          failed: { type: 'integer', example: 0 },
          ids: { type: 'array', items: { type: 'string' } },
          error: { type: 'string', description: 'Present only if the Notification Service could not be reached' },
        },
      },
    },
  },
  NearbyVehicle: {
    allOf: [
      { $ref: '#/components/schemas/Vehicle' },
      { type: 'object', properties: { distanceKm: { type: 'number', example: 1.254, description: 'Great-circle distance from the search centre' } } },
    ],
  },
  NearbyResponse: {
    type: 'object',
    properties: {
      center: { type: 'object', properties: { lat: { type: 'number', example: 9.9658 }, lng: { type: 'number', example: 76.2856 }, displayName: { type: 'string' } } },
      radiusKm: { type: 'number', example: 5 },
      count: { type: 'integer', example: 2 },
      data: { type: 'array', items: { $ref: '#/components/schemas/NearbyVehicle' } },
    },
  },

  // ------------------------------------------------------------- telemetry
  TelemetryInput: {
    type: 'object',
    required: ['vehicleId', 'lat', 'lng'],
    properties: {
      vehicleId: id('665f1c2e8b3a4d0012345678'),
      lat: { type: 'number', example: 9.9816 },
      lng: { type: 'number', example: 76.2999 },
      speed: { type: 'number', minimum: 0, maximum: 300, example: 42, description: 'km/h' },
      fuelLevel: { type: 'number', minimum: 0, maximum: 100, example: 63, description: '%' },
      batteryVoltage: { type: 'number', example: 12.6, description: 'Volts – below 11.5 V triggers LOW_BATTERY' },
      engineTemp: { type: 'number', example: 88, description: '°C – above 110 °C triggers ENGINE_FAULT' },
      eventType: { type: 'string', enum: ['ENGINE_FAULT', 'LOW_BATTERY', 'EMERGENCY_STOP', 'NORMAL', 'IGNITION_ON', 'IGNITION_OFF', 'HARSH_BRAKING', 'OVERSPEED'] },
      timestamp: { ...ts, description: 'Defaults to now; cannot be in the future' },
    },
  },
  Telemetry: {
    type: 'object',
    properties: {
      id: id('665f20aa8b3a4d0012349999'),
      vehicleId: id('665f1c2e8b3a4d0012345678'),
      lat: { type: 'number', example: 9.9816 },
      lng: { type: 'number', example: 76.2999 },
      location: { $ref: '#/components/schemas/GeoPoint' },
      speed: { type: 'number', example: 42 },
      fuelLevel: { type: 'number', example: 63 },
      batteryVoltage: { type: 'number', example: 11.1 },
      engineTemp: { type: 'number', example: 88 },
      eventType: { type: 'string', nullable: true, example: 'LOW_BATTERY' },
      critical: { type: 'boolean', example: true },
      criticalEvents: {
        type: 'array',
        items: { type: 'object', properties: { event: { type: 'string', example: 'LOW_BATTERY' }, detectedBy: { type: 'string', enum: ['explicit', 'threshold'] }, detail: { type: 'string' } } },
      },
      locationSynced: { type: 'boolean', example: true, description: 'Whether the vehicle\'s current location was updated' },
      notification: { type: 'object', properties: { count: { type: 'integer' }, sent: { type: 'integer' }, failed: { type: 'integer' }, ids: { type: 'array', items: { type: 'string' } } } },
      timestamp: ts,
      receivedAt: ts,
    },
  },
  TelemetryResponse: {
    type: 'object',
    properties: {
      telemetry: { $ref: '#/components/schemas/Telemetry' },
      critical: {
        type: 'object',
        properties: {
          detected: { type: 'boolean', example: true },
          events: { type: 'array', items: { type: 'object' } },
          notifications: { type: 'object', nullable: true, properties: { count: { type: 'integer', example: 1 }, sent: { type: 'integer', example: 1 }, failed: { type: 'integer', example: 0 } } },
        },
      },
    },
  },
  TelemetryList: {
    allOf: [paginated('Telemetry'), { type: 'object', properties: { vehicleId: { type: 'string' } } }],
  },

  // ------------------------------------------------------------- maps
  GeoResult: {
    type: 'object',
    properties: {
      lat: { type: 'number', example: 9.9658 },
      lng: { type: 'number', example: 76.2856 },
      displayName: { type: 'string', example: 'MG Road, Ernakulam, Kochi, Kerala, India' },
      provider: { type: 'string', enum: ['nominatim', 'google', 'mock'], example: 'nominatim' },
      cached: { type: 'boolean', example: false, description: 'true when served from the MongoDB geocode cache' },
      fallbackFrom: { type: 'string', example: 'nominatim', description: 'Only present when the primary provider failed and GEO_FALLBACK_PROVIDER answered instead' },
      fallbackReason: { oneOf: [{ type: 'integer' }, { type: 'string' }], example: 429, description: 'Why the primary provider failed (HTTP status or network error code)' },
    },
  },
  ReverseGeoResult: {
    type: 'object',
    properties: {
      lat: { type: 'number', example: 9.9658 },
      lng: { type: 'number', example: 76.2856 },
      displayName: { type: 'string', example: 'Mahatma Gandhi Road, Ernakulam, Kochi, Kerala, 682011, India' },
      address: { type: 'object', additionalProperties: true },
      provider: { type: 'string', example: 'nominatim' },
      fallbackFrom: { type: 'string', example: 'nominatim', description: 'Only present when the primary provider failed and GEO_FALLBACK_PROVIDER answered instead' },
      fallbackReason: { oneOf: [{ type: 'integer' }, { type: 'string' }], example: 429, description: 'Why the primary provider failed (HTTP status or network error code)' },
    },
  },
  DistanceResult: {
    type: 'object',
    properties: {
      from: { $ref: '#/components/schemas/LatLng' },
      to: { $ref: '#/components/schemas/LatLng' },
      distanceKm: { type: 'number', example: 6.52 },
      distanceMeters: { type: 'integer', example: 6520 },
      method: { type: 'string', example: 'haversine' },
    },
  },

  // ------------------------------------------------------------- notifications
  Notification: {
    type: 'object',
    properties: {
      id: id('665f22bb8b3a4d001234aaaa'),
      to: { type: 'string', example: '+919847000001' },
      message: { type: 'string', example: '🚨 CRITICAL: Vehicle KL-07-AB-1234 reported LOW_BATTERY (Battery 11.1V < 11.5V) at 9.9816,76.2999.' },
      type: { type: 'string', enum: NOTIFICATION_TYPES, example: 'CRITICAL_EVENT' },
      provider: { type: 'string', enum: ['stub', 'twilio'], example: 'stub' },
      status: { type: 'string', enum: ['queued', 'sent', 'failed'], example: 'sent' },
      providerMessageId: { type: 'string', nullable: true, example: 'stub-5b0f0c8e-2f7a-4c55-9d43-7c1f0a6b1d2e' },
      error: { type: 'string', nullable: true, example: null },
      attempts: { type: 'integer', example: 1, description: '1 = first try succeeded, 2 = retried once' },
      vehicleId: { type: 'string', nullable: true, example: '665f1c2e8b3a4d0012345678' },
      event: { type: 'string', nullable: true, example: 'LOW_BATTERY' },
      recipient: { type: 'object', properties: { userId: { type: 'string' }, name: { type: 'string' }, role: { type: 'string' } } },
      sentAt: { ...ts, nullable: true },
      createdAt: ts,
      updatedAt: ts,
    },
  },
  NotificationList: paginated('Notification'),
  SmsRequest: {
    type: 'object',
    required: ['to', 'message'],
    properties: {
      to: { type: 'string', pattern: '^\\+[1-9]\\d{7,14}$', example: '+919847000001', description: 'E.164. Numbers ending in 0000 always fail on the stub provider.' },
      message: { type: 'string', example: 'Test message from the Fleet Management System' },
      type: { type: 'string', enum: NOTIFICATION_TYPES, default: 'MANUAL' },
      vehicleId: { type: 'string' },
      event: { type: 'string' },
    },
  },
  NotifyRequest: {
    type: 'object',
    required: ['type', 'message', 'recipients'],
    properties: {
      type: { type: 'string', enum: NOTIFICATION_TYPES, example: 'MANUAL' },
      message: { type: 'string', example: 'Depot closes early today at 6 PM.' },
      vehicleId: { type: 'string' },
      event: { type: 'string' },
      recipients: {
        type: 'object',
        properties: {
          roles: { type: 'array', items: { type: 'string', enum: ROLES }, example: ['fleet_manager'] },
          userIds: { type: 'array', items: { type: 'string' } },
          phones: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  NotifyResponse: {
    type: 'object',
    properties: {
      count: { type: 'integer', example: 2 },
      sent: { type: 'integer', example: 2 },
      failed: { type: 'integer', example: 0 },
      data: { type: 'array', items: { $ref: '#/components/schemas/Notification' } },
    },
  },
  NotificationStats: {
    type: 'object',
    properties: {
      total: { type: 'integer', example: 12 },
      queued: { type: 'integer', example: 0 },
      sent: { type: 'integer', example: 10 },
      failed: { type: 'integer', example: 2 },
      byType: { type: 'object', example: { CRITICAL_EVENT: 3, STATUS_CHANGE: 8, MANUAL: 1 } },
    },
  },

  // ------------------------------------------------------------- gateway
  GatewayHealth: {
    type: 'object',
    properties: {
      project: { type: 'string', example: 'Fleet Management System – Third-party Integrations, API Gateway' },
      author: { type: 'string', example: 'Ashfaaq Feroz Muhammad' },
      bitsId: { type: 'string', example: '2023EBCS005' },
      status: { type: 'string', enum: ['ok', 'degraded'], example: 'ok' },
      gateway: { type: 'object', properties: { status: { type: 'string', example: 'up' }, uptimeSeconds: { type: 'integer', example: 42 } } },
      services: {
        type: 'object',
        additionalProperties: { type: 'object', properties: { status: { type: 'string', enum: ['up', 'down'] }, db: { type: 'string' }, latencyMs: { type: 'integer' }, error: { type: 'string' } } },
        example: { 'user-service': { status: 'up', db: 'connected', latencyMs: 4 }, 'vehicle-service': { status: 'down', error: 'ECONNREFUSED' } },
      },
      timestamp: ts,
    },
  },
};
