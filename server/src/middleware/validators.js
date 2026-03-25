import { toHttpError } from "../utils/api.js";

const PRICE_FIELDS = ["carPrice", "motorcyclePrice", "ebikePrice"];
const VEHICLE_PRICE_KEYS = new Set(PRICE_FIELDS);

function isValidHmTime(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function assertNumberField(payload, field, { min = 0 } = {}) {
  if (payload[field] === undefined) {
    return;
  }

  if (typeof payload[field] !== "number" || !Number.isFinite(payload[field])) {
    throw toHttpError(`${field} must be a valid number`, 422);
  }

  if (payload[field] < min) {
    throw toHttpError(`${field} must be >= ${min}`, 422);
  }
}

function isValidIsoDate(value) {
  if (typeof value !== "string") {
    return false;
  }

  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp);
}

function isValidYmdDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validateSettingsPatch(req, res, next) {
  const payload = req.body || {};

  for (const field of PRICE_FIELDS) {
    assertNumberField(payload, field, { min: 0 });
  }

  if (payload.kioskName !== undefined && typeof payload.kioskName !== "string") {
    throw toHttpError("kioskName must be a string", 422);
  }

  if (payload.location !== undefined && typeof payload.location !== "string") {
    throw toHttpError("location must be a string", 422);
  }

  if (payload.receiptHeader !== undefined && typeof payload.receiptHeader !== "string") {
    throw toHttpError("receiptHeader must be a string", 422);
  }

  if (payload.receiptFooter !== undefined && typeof payload.receiptFooter !== "string") {
    throw toHttpError("receiptFooter must be a string", 422);
  }

  if (payload.operatingHours !== undefined) {
    if (typeof payload.operatingHours !== "object" || payload.operatingHours === null) {
      throw toHttpError("operatingHours must be an object", 422);
    }

    const { open, close } = payload.operatingHours;
    if (open !== undefined && !isValidHmTime(open)) {
      throw toHttpError("operatingHours.open must match HH:mm", 422);
    }
    if (close !== undefined && !isValidHmTime(close)) {
      throw toHttpError("operatingHours.close must match HH:mm", 422);
    }
  }

  return next();
}

export function validateVehiclePatch(req, res, next) {
  const payload = req.body || {};

  if (payload.type !== undefined && typeof payload.type !== "string") {
    throw toHttpError("type must be a string", 422);
  }

  if (payload.label !== undefined && typeof payload.label !== "string") {
    throw toHttpError("label must be a string", 422);
  }

  if (payload.sub !== undefined && typeof payload.sub !== "string") {
    throw toHttpError("sub must be a string", 422);
  }

  if (payload.color !== undefined && typeof payload.color !== "string") {
    throw toHttpError("color must be a string", 422);
  }

  if (payload.icon !== undefined && typeof payload.icon !== "string") {
    throw toHttpError("icon must be a string", 422);
  }

  if (payload.enabled !== undefined && typeof payload.enabled !== "boolean") {
    throw toHttpError("enabled must be a boolean", 422);
  }

  if (payload.priceKey !== undefined && !VEHICLE_PRICE_KEYS.has(payload.priceKey)) {
    throw toHttpError("priceKey must be one of carPrice, motorcyclePrice, ebikePrice", 422);
  }

  return next();
}

export function validateLogin(req, res, next) {
  const payload = req.body || {};

  if (typeof payload.username !== "string" || payload.username.trim().length === 0) {
    throw toHttpError("username is required", 422);
  }

  if (typeof payload.password !== "string" || payload.password.length === 0) {
    throw toHttpError("password is required", 422);
  }

  return next();
}

export function validateCreateTransaction(req, res, next) {
  const payload = req.body || {};

  if (payload.type !== undefined && typeof payload.type !== "string") {
    throw toHttpError("type must be a string", 422);
  }

  if (payload.status !== undefined && typeof payload.status !== "string") {
    throw toHttpError("status must be a string", 422);
  }

  if (payload.kioskId !== undefined && typeof payload.kioskId !== "string") {
    throw toHttpError("kioskId must be a string", 422);
  }

  if (payload.controlNumber !== undefined && typeof payload.controlNumber !== "string") {
    throw toHttpError("controlNumber must be a string", 422);
  }

  if (payload.timestamp !== undefined && !isValidIsoDate(payload.timestamp)) {
    throw toHttpError("timestamp must be a valid ISO date", 422);
  }

  if (payload.amount === undefined) {
    throw toHttpError("amount is required", 422);
  }

  assertNumberField(payload, "amount", { min: 0.01 });
  return next();
}

export function validateCreateExpense(req, res, next) {
  const payload = req.body || {};

  if (typeof payload.label !== "string" || payload.label.trim().length === 0) {
    throw toHttpError("label is required", 422);
  }

  if (payload.category !== undefined && typeof payload.category !== "string") {
    throw toHttpError("category must be a string", 422);
  }

  if (payload.description !== undefined && typeof payload.description !== "string") {
    throw toHttpError("description must be a string", 422);
  }

  if (payload.date !== undefined && !isValidYmdDate(payload.date)) {
    throw toHttpError("date must match YYYY-MM-DD", 422);
  }

  if (payload.amount === undefined) {
    throw toHttpError("amount is required", 422);
  }

  assertNumberField(payload, "amount", { min: 0.01 });
  return next();
}

export function validatePaymentWebhook(req, res, next) {
  const payload = req.body || {};

  if (payload.eventId !== undefined && typeof payload.eventId !== "string") {
    throw toHttpError("eventId must be a string", 422);
  }

  const hasCoinAmount = payload.coinAmount !== undefined;
  const hasAmount = payload.amount !== undefined;
  const hasCoinPayload = hasCoinAmount || hasAmount;

  if (hasCoinPayload) {
    if (hasCoinAmount) {
      assertNumberField(payload, "coinAmount", { min: 0.01 });
    }

    if (hasAmount) {
      assertNumberField(payload, "amount", { min: 0.01 });
    }
  } else {
    if (payload.targetAmount === undefined) {
      throw toHttpError("targetAmount is required for payment initialization", 422);
    }
    assertNumberField(payload, "targetAmount", { min: 0.01 });

    const hasType = typeof payload.type === "string" && payload.type.trim().length > 0;
    const hasVehicleType = typeof payload.vehicleType === "string" && payload.vehicleType.trim().length > 0;
    if (!hasType && !hasVehicleType) {
      throw toHttpError("vehicleType (or type) is required for payment initialization", 422);
    }
  }

  if (payload.timestamp !== undefined && !isValidIsoDate(payload.timestamp)) {
    throw toHttpError("timestamp must be a valid ISO date", 422);
  }

  if (payload.kioskId !== undefined && typeof payload.kioskId !== "string") {
    throw toHttpError("kioskId must be a string", 422);
  }

  if (payload.type !== undefined && typeof payload.type !== "string") {
    throw toHttpError("type must be a string", 422);
  }

  if (payload.vehicleType !== undefined && typeof payload.vehicleType !== "string") {
    throw toHttpError("vehicleType must be a string", 422);
  }

  return next();
}

export function validatePaymentSessionStart(req, res, next) {
  const payload = req.body || {};

  if (payload.targetAmount === undefined) {
    throw toHttpError("targetAmount is required for payment initialization", 422);
  }

  assertNumberField(payload, "targetAmount", { min: 0.01 });

  const hasType = typeof payload.type === "string" && payload.type.trim().length > 0;
  const hasVehicleType =
    typeof payload.vehicleType === "string" &&
    payload.vehicleType.trim().length > 0;

  if (!hasType && !hasVehicleType) {
    throw toHttpError("vehicleType (or type) is required for payment initialization", 422);
  }

  if (payload.kioskId !== undefined && typeof payload.kioskId !== "string") {
    throw toHttpError("kioskId must be a string", 422);
  }

  if (payload.type !== undefined && typeof payload.type !== "string") {
    throw toHttpError("type must be a string", 422);
  }

  if (payload.vehicleType !== undefined && typeof payload.vehicleType !== "string") {
    throw toHttpError("vehicleType must be a string", 422);
  }

  return next();
}
