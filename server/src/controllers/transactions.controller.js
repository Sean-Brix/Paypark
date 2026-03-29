import { prisma } from "../config/prisma.js";
import { sendSuccess, toHttpError } from "../utils/api.js";
import { generateControlNumber } from "../utils/controlNumber.js";

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

function toDateFilter(value, boundary) {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (!normalized.includes("T")) {
    if (boundary === "start") {
      date.setHours(0, 0, 0, 0);
    } else {
      date.setHours(23, 59, 59, 999);
    }
  }

  return date;
}

function buildIdSearchCondition(term) {
  const normalized = String(term || "").trim();
  if (!normalized) {
    return null;
  }

  return {
    OR: [
      { id: { contains: normalized } },
      { controlNumber: { contains: normalized } },
    ],
  };
}

function buildTransactionSearchCondition(term) {
  const normalized = String(term || "").trim();
  if (!normalized) {
    return null;
  }

  const numericValue = Number.parseFloat(normalized);
  const or = [
    { id: { contains: normalized } },
    { controlNumber: { contains: normalized } },
    { type: { contains: normalized } },
    { status: { contains: normalized } },
    { kioskId: { contains: normalized } },
  ];

  if (Number.isFinite(numericValue)) {
    or.push({ amount: numericValue });
  }

  return { OR: or };
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

export async function listTransactions(req, res) {
  const page = toPositiveInt(req.query.page, 1);
  const limit = toPositiveInt(req.query.limit, 20, { max: 100 });
  const skip = (page - 1) * limit;
  const dateFrom = toDateFilter(req.query.dateFrom, "start");
  const dateTo = toDateFilter(req.query.dateTo, "end");
  const idSearch = buildIdSearchCondition(req.query.id);
  const textSearch = buildTransactionSearchCondition(req.query.search);
  const and = [idSearch, textSearch].filter(Boolean);

  const where = {
    ...(req.query.type ? { type: String(req.query.type) } : {}),
    ...(req.query.status ? { status: String(req.query.status) } : {}),
    ...(dateFrom || dateTo
      ? {
          timestamp: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : {}),
    ...(and.length > 0 ? { AND: and } : {}),
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
  const transactionDate = payload.timestamp ? new Date(payload.timestamp) : new Date();
  const controlNumber =
    payload.controlNumber ||
    (await generateControlNumber({
      prisma,
      date: transactionDate,
    }));

  try {
    const created = await prisma.transaction.create({
      data: {
        id: payload.id || crypto.randomUUID(),
        type: payload.type || DEFAULT_TYPE,
        amount: payload.amount,
        timestamp: transactionDate,
        status: payload.status || DEFAULT_STATUS,
        kioskId: payload.kioskId || DEFAULT_KIOSK_ID,
        controlNumber,
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
