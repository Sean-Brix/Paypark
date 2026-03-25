import { prisma } from "../config/prisma.js";
import { toHttpError } from "../utils/api.js";

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

function cleanupOldEvents() {
  const now = Date.now();
  for (const [key, createdAt] of processedEvents.entries()) {
    if (now - createdAt > EVENT_TTL_MS) {
      processedEvents.delete(key);
    }
  }
}

function toAmount(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPaymentStatusPayload(transaction, targetAmount = null) {
  const totalInserted = Number(transaction?.amount ?? 0);
  const target =
    typeof targetAmount === "number" && Number.isFinite(targetAmount)
      ? targetAmount
      : null;
  const remaining = target !== null ? Math.max(0, target - totalInserted) : null;
  const isPaid =
    target !== null ? totalInserted >= target : transaction?.status === "Success";

  return {
    status: isPaid ? "Success" : "Pending",
    totalInserted,
    targetAmount: target,
    remaining,
    transaction: transaction ? toTransactionDto(transaction) : null,
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

function buildControlNumber(prefix = "ESP") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function getActiveSessionForTransaction(transaction) {
  if (!transaction?.kioskId) {
    return null;
  }

  const active = activePayments.get(transaction.kioskId);
  if (!active || active.controlNumber !== transaction.controlNumber) {
    return null;
  }

  return active;
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
  cleanupOldEvents();

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

  const controlNumber = buildControlNumber("ESP-ACTIVE");
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

  await safePublishOpen(1);

  const response = {
    kioskId,
    controlNumber,
    ...toPaymentStatusPayload(transaction, targetAmount),
  };

  await safePublishStatus(response);

  return response;
}

export async function recordPaymentCoin(payload = {}) {
  cleanupOldEvents();

  const eventId = String(payload.eventId || "").trim();
  const coinAmount = toAmount(payload.coinAmount ?? payload.amount, NaN);
  const kioskId = normalizeKioskId(payload.kioskId);

  if (!Number.isFinite(coinAmount) || coinAmount <= 0) {
    throw toHttpError("coin amount must be a number greater than 0", 422);
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
        controlNumber: buildControlNumber("ESP-ACTIVE"),
      },
    });
  }

  if (eventId) {
    const eventKey = `${existing.controlNumber}:${eventId}`;
    if (processedEvents.has(eventKey)) {
      return {
        duplicate: true,
        kioskId,
        controlNumber: existing.controlNumber,
        ...toPaymentStatusPayload(existing, active?.targetAmount ?? null),
      };
    }

    processedEvents.set(eventKey, Date.now());
  }

  const previousAmount = Number(existing.amount ?? 0);
  const nextAmount = previousAmount + coinAmount;
  const targetAmount = active?.targetAmount ?? null;
  const shouldMarkSuccess =
    typeof targetAmount === "number" ? nextAmount >= targetAmount : false;

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

  const response = {
    duplicate: false,
    kioskId,
    controlNumber: transaction.controlNumber,
    coinAmount,
    ...toPaymentStatusPayload(transaction, targetAmount),
  };

  await safePublishStatus(response);

  if (shouldMarkSuccess) {
    await safePublishPaid(1);
  }

  return response;
}

export async function getPaymentStatus(payload = {}) {
  cleanupOldEvents();

  const controlNumber =
    typeof payload.controlNumber === "string" && payload.controlNumber.trim().length > 0
      ? payload.controlNumber.trim()
      : null;
  const kioskId = normalizeKioskId(payload.kioskId);

  let transaction = controlNumber
    ? await prisma.transaction.findUnique({ where: { controlNumber } })
    : null;

  if (!transaction) {
    const active = activePayments.get(kioskId);
    if (active?.controlNumber) {
      transaction = await prisma.transaction.findUnique({
        where: { controlNumber: active.controlNumber },
      });
    }
  }

  if (!transaction) {
    return {
      kioskId,
      controlNumber,
      status: "Pending",
      totalInserted: 0,
      targetAmount: activePayments.get(kioskId)?.targetAmount ?? null,
      remaining: activePayments.get(kioskId)?.targetAmount ?? null,
      transaction: null,
    };
  }

  const active = getActiveSessionForTransaction(transaction);

  return {
    kioskId: transaction.kioskId,
    controlNumber: transaction.controlNumber,
    ...toPaymentStatusPayload(transaction, active?.targetAmount ?? null),
  };
}
