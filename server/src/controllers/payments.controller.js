import { sendSuccess } from "../utils/api.js";
import {
  getPaymentStatus as loadPaymentStatus,
  initializePaymentSession,
  recordPaymentCoin,
} from "../services/payment.service.js";

function hasCoinPayload(payload = {}) {
  return payload.coinAmount !== undefined || payload.amount !== undefined;
}

export async function startPaymentSession(req, res) {
  const payment = await initializePaymentSession(req.body || {});

  return sendSuccess(res, payment, "Payment initialized", 201);
}

export async function getPaymentStatus(req, res) {
  const status = await loadPaymentStatus(req.query || {});
  return sendSuccess(res, status, "Payment status loaded", 200);
}

export async function receivePaymentWebhook(req, res) {
  const payload = req.body || {};

  if (!hasCoinPayload(payload)) {
    const payment = await initializePaymentSession(payload);
    return sendSuccess(res, payment, "Payment initialized", 201);
  }

  const result = await recordPaymentCoin(payload);
  return sendSuccess(
    res,
    result,
    result.duplicate ? "Duplicate event ignored" : "Coin recorded",
    200
  );
}
