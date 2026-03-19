import { prisma } from "../config/prisma.js";
import { sendSuccess, toHttpError } from "../utils/api.js";

const DEFAULT_KIOSK_ID = "KIOSK-001";
const DEFAULT_STATUS = "Success";
const DEFAULT_TYPE = "Unknown";

function toPositiveInt(value, fallback, { max } = {}) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  if (typeof max === "number" && parsed > max) {
    return max;
  }
  return parsed;
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
  };
}

function buildControlNumber() {
  return `CTRL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export async function listTransactions(req, res) {
  const page = toPositiveInt(req.query.page, 1);
  const limit = toPositiveInt(req.query.limit, 20, { max: 100 });
  const skip = (page - 1) * limit;

  const where = {
    ...(req.query.type ? { type: String(req.query.type) } : {}),
    ...(req.query.status ? { status: String(req.query.status) } : {}),
    ...(req.query.dateFrom || req.query.dateTo
      ? {
          timestamp: {
            ...(req.query.dateFrom ? { gte: new Date(String(req.query.dateFrom)) } : {}),
            ...(req.query.dateTo ? { lte: new Date(String(req.query.dateTo)) } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return sendSuccess(
    res,
    {
      items: items.map(toTransactionDto),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    },
    "Transactions loaded"
  );
}

export async function createTransaction(req, res) {
  const payload = req.body || {};

  try {
    const created = await prisma.transaction.create({
      data: {
        id: payload.id || crypto.randomUUID(),
        type: payload.type || DEFAULT_TYPE,
        amount: payload.amount,
        timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
        status: payload.status || DEFAULT_STATUS,
        kioskId: payload.kioskId || DEFAULT_KIOSK_ID,
        controlNumber: payload.controlNumber || buildControlNumber(),
      },
    });

    return sendSuccess(res, toTransactionDto(created), "Transaction created", 201);
  } catch (error) {
    if (error?.code === "P2002") {
      throw toHttpError("controlNumber already exists", 409);
    }
    throw error;
  }
}
