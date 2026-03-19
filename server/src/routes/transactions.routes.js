import { Router } from "express";
import { listTransactions, createTransaction } from "../controllers/transactions.controller.js";
import { validateCreateTransaction } from "../middleware/validators.js";
import { asyncHandler } from "../utils/api.js";

export const transactionsRouter = Router();

transactionsRouter.get("/", asyncHandler(listTransactions));
transactionsRouter.post("/", validateCreateTransaction, asyncHandler(createTransaction));
