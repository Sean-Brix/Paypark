import { prisma } from "../config/prisma.js";
import { sendSuccess, toHttpError } from "../utils/api.js";

const DEFAULT_KIOSK_ID = "KIOSK-001";
const DEFAULT_STATUS = "Pending";
const DEFAULT_TYPE = "Unknown";
const processedEvents = new Map();
const activePayments = new Map();
const EVENT_TTL_MS = 10 * 60 * 1000;

function toTransactionDto(row) {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    timestamp: row.timestamp,
    status: row.status,
    kioskId: row.kioskId,
    controlNumber: row.controlNumber,
  };
}

function cleanupOldEvents() {
  const now = Date.now();
  for (const [key, createdAt] of processedEvents.entries()) {
    if (now - createdAt > EVENT_TTL_MS) {
      processedEvents.delete(key);
    }
  }
}

function getControlNumberFromSession(sessionId) {
  return `ESP-${sessionId}`;
}

function toAmount(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPaymentStatusPayload(transaction, targetAmount = null) {
  const totalInserted = Number(transaction?.amount ?? 0);
  const target = typeof targetAmount === "number" && Number.isFinite(targetAmount) ? targetAmount : null;
  const remaining = target !== null ? Math.max(0, target - totalInserted) : null;
  const isPaid = target !== null ? totalInserted >= target : transaction?.status === "Success";

  return {
    status: isPaid ? "Success" : "Pending",
    totalInserted,
    targetAmount: target,
    remaining,
    transaction: transaction ? toTransactionDto(transaction) : null,
  };
}

export async function receivePaymentWebhook(req, res) {
  cleanupOldEvents();

  const payload = req.body || {};
  const eventId = String(payload.eventId || "").trim();
  const coinAmount = toAmount(payload.coinAmount ?? payload.amount, NaN);
  const kioskId = (typeof payload.kioskId === "string" && payload.kioskId.trim().length > 0)
    ? payload.kioskId.trim()
    : (typeof req.query.kioskId === "string" && req.query.kioskId.trim().length > 0)
      ? req.query.kioskId.trim()
      : DEFAULT_KIOSK_ID;

  const hasCoin = Number.isFinite(coinAmount) && coinAmount > 0;

  if (!hasCoin) {
    const vehicleType = payload.vehicleType || payload.type;
    const targetAmount = payload.targetAmount !== undefined
      ? toAmount(payload.targetAmount, NaN)
      : NaN;

    if (typeof vehicleType !== "string" || vehicleType.trim().length === 0) {
      throw toHttpError("vehicleType (or type) is required for payment initialization", 422);
    }

    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      throw toHttpError("targetAmount must be a number greater than 0 for payment initialization", 422);
    }

    const controlNumber = `ESP-ACTIVE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const transaction = await prisma.transaction.create({
      data: {
        id: crypto.randomUUID(),
        type: vehicleType.trim(),
        amount: 0,
        timestamp: new Date(),
        status: "Pending",
        kioskId,
        controlNumber,
      },
    });

    activePayments.set(kioskId, {
      controlNumber,
      targetAmount,
      type: vehicleType.trim(),
    });

    return sendSuccess(
      res,
      {
        kioskId,
        controlNumber,
        ...toPaymentStatusPayload(transaction, targetAmount),
      },
      "Payment initialized",
      201
    );
  }

  const active = activePayments.get(kioskId);
  const controlNumber = active?.controlNumber;
  let existing = controlNumber
    ? await prisma.transaction.findUnique({ where: { controlNumber } })
    : null;

  if (!existing) {
    existing = await prisma.transaction.findFirst({
      where: {
        kioskId,
        status: "Pending",
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  if (!existing) {
    existing = await prisma.transaction.create({
      data: {
        id: crypto.randomUUID(),
        type: DEFAULT_TYPE,
        amount: 0,
        timestamp: new Date(),
        status: "Pending",
        kioskId,
        controlNumber: `ESP-ACTIVE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      },
    });
  }

  if (eventId) {
    const eventKey = `${existing.controlNumber}:${eventId}`;
    if (processedEvents.has(eventKey)) {
      return sendSuccess(
        res,
        {
          duplicate: true,
          controlNumber: existing.controlNumber,
          ...toPaymentStatusPayload(existing, active?.targetAmount ?? null),
        },
        "Duplicate event ignored",
        200
      );
    }

    processedEvents.set(eventKey, Date.now());
  }

  const previousAmount = Number(existing?.amount ?? 0);
  const nextAmount = previousAmount + coinAmount;
  const targetAmount = active?.targetAmount ?? null;
  const shouldMarkSuccess = typeof targetAmount === "number" ? nextAmount >= targetAmount : false;

  const transaction = await prisma.transaction.update({
    where: { controlNumber: existing.controlNumber },
    data: {
      amount: nextAmount,
      timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
      status: shouldMarkSuccess ? "Success" : "Pending",
      type: payload.vehicleType || payload.type || existing.type || DEFAULT_TYPE,
    },
  });

  if (shouldMarkSuccess) {
    activePayments.delete(kioskId);
  }

  return sendSuccess(
    res,
    {
      duplicate: false,
      kioskId,
      controlNumber: transaction.controlNumber,
      coinAmount,
      ...toPaymentStatusPayload(transaction, targetAmount),
    },
    "Coin recorded",
    200
  );
}
