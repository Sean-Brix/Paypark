import { Router } from "express";
import {
  getPaymentStatus,
  receivePaymentWebhook,
  startPaymentSession,
} from "../controllers/payments.controller.js";
import {
  validatePaymentSessionStart,
  validatePaymentWebhook,
} from "../middleware/validators.js";
import { asyncHandler } from "../utils/api.js";

export const paymentsRouter = Router();

paymentsRouter.get("/status", asyncHandler(getPaymentStatus));
paymentsRouter.post(
  "/session",
  validatePaymentSessionStart,
  asyncHandler(startPaymentSession)
);
paymentsRouter.post("/webhook", validatePaymentWebhook, asyncHandler(receivePaymentWebhook));
