import { prisma } from "../config/prisma.js";
import { toHttpError } from "../utils/api.js";
import { generateControlNumber } from "../utils/controlNumber.js";

const DEFAULT_KIOSK_ID = "KIOSK-001";
const DEFAULT_TYPE = "Unknown";
const processedEvents = new Map();
const activePayments = new Map();
const EVENT_TTL_MS = 10 * 60 * 1000;

let publishPaidSignal = async () => {};
let publishOpenSignal = async () => {};
let publishPaymentStatus = async () => {};

function normalizeKioskId(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : DEFAULT_KIOSK_ID;
}

function toTransactionDto(row) {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    timestamp: row.timestamp,
    status: row.status,
    kioskId: row.kioskId,
    controlNumber: row.controlNumber,
    createdAt: row.createdAt ?? row.timestamp,
  };
}

function cleanupStalePaymentState() {
  const now = Date.now();

  for (const [key, createdAt] of processedEvents.entries()) {
    if (now - createdAt > EVENT_TTL_MS) {
      processedEvents.delete(key);
    }
  }

  for (const [kioskId, payment] of activePayments.entries()) {
    if (now - Number(payment?.updatedAt ?? 0) > EVENT_TTL_MS) {
      activePayments.delete(kioskId);
    }
  }
}

function toAmount(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPaymentStatusPayload({
  totalInserted = 0,
  targetAmount = null,
  status = "Pending",
  transaction = null,
} = {}) {
  const inserted = Number(totalInserted ?? transaction?.amount ?? 0);
  const target =
    typeof targetAmount === "number" && Number.isFinite(targetAmount)
      ? targetAmount
      : null;
  const remaining = target !== null ? Math.max(0, target - inserted) : null;
  const isPaid = status === "Success" || (target !== null && inserted >= target);

  return {
    status: isPaid ? "Success" : "Pending",
    totalInserted: inserted,
    targetAmount: target,
    remaining,
    transaction: transaction ? toTransactionDto(transaction) : null,
  };
}

function toActivePaymentResponse(kioskId, payment) {
  return {
    kioskId,
    controlNumber: payment.controlNumber,
    ...toPaymentStatusPayload({
      totalInserted: payment.totalInserted,
      targetAmount: payment.targetAmount,
      status: payment.status,
      transaction: payment.transaction,
    }),
  };
}

async function safePublishStatus(payload) {
  try {
    await publishPaymentStatus(payload);
  } catch (error) {
    console.error(`MQTT status publish failed: ${error.message}`);
  }
}

async function safePublishPaid(payload) {
  try {
    await publishPaidSignal(payload);
  } catch (error) {
    console.error(`MQTT paid publish failed: ${error.message}`);
  }
}

async function safePublishOpen(payload) {
  try {
    await publishOpenSignal(payload);
  } catch (error) {
    console.error(`MQTT open publish failed: ${error.message}`);
  }
}

function buildPaymentSession({
  controlNumber,
  targetAmount,
  type,
  totalInserted = 0,
  status = "Pending",
  transaction = null,
}) {
  return {
    controlNumber,
    targetAmount,
    type,
    totalInserted,
    status,
    transaction,
    updatedAt: Date.now(),
  };
}

export function configurePaymentRealtime({
  publishPaid,
  publishOpen,
  publishStatus,
} = {}) {
  publishPaidSignal = typeof publishPaid === "function" ? publishPaid : async () => {};
  publishOpenSignal = typeof publishOpen === "function" ? publishOpen : async () => {};
  publishPaymentStatus =
    typeof publishStatus === "function" ? publishStatus : async () => {};
}

export async function initializePaymentSession(payload = {}) {
  cleanupStalePaymentState();

  const kioskId = normalizeKioskId(payload.kioskId);
  const vehicleType = payload.vehicleType || payload.type;
  const targetAmount = toAmount(payload.targetAmount, NaN);

  if (typeof vehicleType !== "string" || vehicleType.trim().length === 0) {
    throw toHttpError(
      "vehicleType (or type) is required for payment initialization",
      422
    );
  }

  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    throw toHttpError(
      "targetAmount must be a number greater than 0 for payment initialization",
      422
    );
  }

  const controlNumber = await generateControlNumber({
    prisma,
    date: new Date(),
    activeControlNumbers: Array.from(activePayments.values()).map(
      (payment) => payment.controlNumber
    ),
  });

  const payment = buildPaymentSession({
    controlNumber,
    targetAmount,
    type: vehicleType.trim(),
  });

  activePayments.set(kioskId, payment);

  await safePublishOpen(1);

  const response = toActivePaymentResponse(kioskId, payment);
  await safePublishStatus(response);

  return response;
}

export async function recordPaymentCoin(payload = {}) {
  cleanupStalePaymentState();

  const eventId = String(payload.eventId || "").trim();
  const coinAmount = toAmount(payload.coinAmount ?? payload.amount, NaN);
  const kioskId = normalizeKioskId(payload.kioskId);

  if (!Number.isFinite(coinAmount) || coinAmount <= 0) {
    throw toHttpError("coin amount must be a number greater than 0", 422);
  }

  const payment = activePayments.get(kioskId);
  if (!payment) {
    throw toHttpError("No active payment session for this kiosk", 409);
  }

  const eventKey = eventId ? `${payment.controlNumber}:${eventId}` : null;

  if (eventKey && processedEvents.has(eventKey)) {
    return {
      duplicate: true,
      kioskId,
      controlNumber: payment.controlNumber,
      ...toPaymentStatusPayload({
        totalInserted: payment.totalInserted,
        targetAmount: payment.targetAmount,
        status: payment.status,
        transaction: payment.transaction,
      }),
    };
  }

  if (payment.status === "Success") {
    if (eventKey) {
      processedEvents.set(eventKey, Date.now());
    }

    return {
      duplicate: true,
      kioskId,
      controlNumber: payment.controlNumber,
      ...toPaymentStatusPayload({
        totalInserted: payment.totalInserted,
        targetAmount: payment.targetAmount,
        status: payment.status,
        transaction: payment.transaction,
      }),
    };
  }

  if (eventKey) {
    processedEvents.set(eventKey, Date.now());
  }

  const nextTotalInserted = Number(payment.totalInserted ?? 0) + coinAmount;
  const nextType = payload.vehicleType || payload.type || payment.type || DEFAULT_TYPE;
  const shouldMarkSuccess = nextTotalInserted >= payment.targetAmount;

  let nextPayment = buildPaymentSession({
    controlNumber: payment.controlNumber,
    targetAmount: payment.targetAmount,
    type: nextType,
    totalInserted: nextTotalInserted,
  });

  if (shouldMarkSuccess) {
    const transaction = await prisma.transaction.create({
      data: {
        id: crypto.randomUUID(),
        type: nextType,
        amount: nextTotalInserted,
        timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
        status: "Success",
        kioskId,
        controlNumber: payment.controlNumber,
      },
    });

    nextPayment = buildPaymentSession({
      controlNumber: payment.controlNumber,
      targetAmount: payment.targetAmount,
      type: nextType,
      totalInserted: nextTotalInserted,
      status: "Success",
      transaction,
    });
  }

  activePayments.set(kioskId, nextPayment);

  const response = {
    duplicate: false,
    kioskId,
    controlNumber: nextPayment.controlNumber,
    coinAmount,
    ...toPaymentStatusPayload({
      totalInserted: nextPayment.totalInserted,
      targetAmount: nextPayment.targetAmount,
      status: nextPayment.status,
      transaction: nextPayment.transaction,
    }),
  };

  await safePublishStatus(response);

  if (shouldMarkSuccess) {
    await safePublishPaid(1);
  }

  return response;
}

export async function getPaymentStatus(payload = {}) {
  cleanupStalePaymentState();

  const controlNumber =
    typeof payload.controlNumber === "string" && payload.controlNumber.trim().length > 0
      ? payload.controlNumber.trim()
      : null;
  const kioskId = normalizeKioskId(payload.kioskId);

  const payment = activePayments.get(kioskId);
  if (payment && (!controlNumber || payment.controlNumber === controlNumber)) {
    return toActivePaymentResponse(kioskId, payment);
  }

  const transaction = controlNumber
    ? await prisma.transaction.findUnique({ where: { controlNumber } })
    : null;

  if (!transaction) {
    return {
      kioskId,
      controlNumber,
      status: "Pending",
      totalInserted: 0,
      targetAmount: null,
      remaining: null,
      transaction: null,
    };
  }

  return {
    kioskId: transaction.kioskId,
    controlNumber: transaction.controlNumber,
    ...toPaymentStatusPayload({
      totalInserted: Number(transaction.amount ?? 0),
      status: transaction.status,
      transaction,
    }),
  };
}
