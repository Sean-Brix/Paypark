import { Router } from "express";
import { healthRouter } from "./health.routes.js";
import { authRouter } from "./auth.routes.js";
import { settingsRouter } from "./settings.routes.js";
import { vehiclesRouter } from "./vehicles.routes.js";
import { transactionsRouter } from "./transactions.routes.js";
import { expensesRouter } from "./expenses.routes.js";
import { paymentsRouter } from "./payments.routes.js";
import { printRouter } from "./print.routes.js";

export const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/settings", settingsRouter);
router.use("/vehicles", vehiclesRouter);
router.use("/transactions", transactionsRouter);
router.use("/expenses", expensesRouter);
router.use("/payments", paymentsRouter);
router.use("/print", printRouter);
