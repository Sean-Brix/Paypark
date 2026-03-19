/**
 * Print Routes
 * Handles receipt printing endpoints
 */

import { Router } from "express";
import { printReceipt } from "../controllers/print.controller.js";

export const printRouter = Router();

/**
 * POST /api/print/receipt
 * Print a parking receipt to the thermal printer
 */
printRouter.post("/receipt", printReceipt);
