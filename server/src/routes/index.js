import { Router } from "express";
import { healthRouter } from "./health.routes.js";
import { authRouter } from "./auth.routes.js";
import { settingsRouter } from "./settings.routes.js";
import { vehiclesRouter } from "./vehicles.routes.js";
import { transactionsRouter } from "./transactions.routes.js";
import { expensesRouter } from "./expenses.routes.js";
import { paymentsRouter } from "./payments.routes.js";
import { printRouter } from "./print.routes.js";
import { requireDatabase } from "../middleware/requireDatabase.js";

export const router = Router();

router.use("/health", healthRouter);

router.use("/auth", requireDatabase, authRouter);
router.use("/settings", requireDatabase, settingsRouter);
router.use("/vehicles", requireDatabase, vehiclesRouter);
router.use("/transactions", requireDatabase, transactionsRouter);
router.use("/expenses", requireDatabase, expensesRouter);
router.use("/payments", requireDatabase, paymentsRouter);
router.use("/print", printRouter);
