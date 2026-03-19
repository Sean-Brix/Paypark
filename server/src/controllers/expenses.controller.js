import { prisma } from "../config/prisma.js";
import { sendSuccess } from "../utils/api.js";

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

function toExpenseDto(row) {
  return {
    id: row.id,
    label: row.label,
    amount: Number(row.amount),
    date: row.date,
    category: row.category,
    description: row.description,
  };
}

export async function listExpenses(req, res) {
  const page = toPositiveInt(req.query.page, 1);
  const limit = toPositiveInt(req.query.limit, 20, { max: 100 });
  const skip = (page - 1) * limit;

  const where = {
    ...(req.query.category ? { category: String(req.query.category) } : {}),
    ...(req.query.dateFrom || req.query.dateTo
      ? {
          date: {
            ...(req.query.dateFrom ? { gte: new Date(String(req.query.dateFrom)) } : {}),
            ...(req.query.dateTo ? { lte: new Date(String(req.query.dateTo)) } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.expense.count({ where }),
  ]);

  return sendSuccess(
    res,
    {
      items: items.map(toExpenseDto),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    },
    "Expenses loaded"
  );
}

export async function createExpense(req, res) {
  const payload = req.body || {};

  const created = await prisma.expense.create({
    data: {
      id: payload.id || crypto.randomUUID(),
      label: payload.label,
      amount: payload.amount,
      date: payload.date ? new Date(payload.date) : new Date(),
      category: payload.category || "General",
      description: payload.description || "",
    },
  });

  return sendSuccess(res, toExpenseDto(created), "Expense created", 201);
}
