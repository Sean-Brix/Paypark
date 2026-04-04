import { Router } from "express";
import {
	listExpenses,
	createExpense,
	removeExpense,
} from "../controllers/expenses.controller.js";
import { validateCreateExpense } from "../middleware/validators.js";
import { asyncHandler } from "../utils/api.js";

export const expensesRouter = Router();

expensesRouter.get("/", asyncHandler(listExpenses));
expensesRouter.post("/", validateCreateExpense, asyncHandler(createExpense));
expensesRouter.delete("/:id", asyncHandler(removeExpense));
