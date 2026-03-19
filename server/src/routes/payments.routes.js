import { Router } from "express";
import { receivePaymentWebhook } from "../controllers/payments.controller.js";
import { validatePaymentWebhook } from "../middleware/validators.js";
import { asyncHandler } from "../utils/api.js";

export const paymentsRouter = Router();

paymentsRouter.post("/webhook", validatePaymentWebhook, asyncHandler(receivePaymentWebhook));
