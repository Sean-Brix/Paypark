# MQTT Migration Notes

## Endpoint Split

Keep these as HTTP:

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/settings`
- `PATCH /api/settings`
- `GET /api/vehicles`
- `PATCH /api/vehicles/:id`
- `GET /api/transactions`
- `POST /api/transactions`
- `GET /api/expenses`
- `POST /api/expenses`
- `POST /api/print/receipt`
- `POST /api/payments/session`
- `GET /api/payments/status`

Use MQTT only for the real-time device payment path:

- `paypark/payment/open`
- `paypark/payment/paying`
- `paypark/payment/paid`

## Current Architecture

1. The kiosk browser starts a payment with `POST /api/payments/session`.
2. The backend creates the pending transaction, stores the target amount in memory, and publishes `paypark/payment/open`.
3. The payment device receives that open message and enables the coin selector.
4. The payment device publishes each coin event to `paypark/payment/paying`.
5. The backend server subscribes to that topic, updates the transaction, and marks payment complete when the target is reached.
6. When payment is complete, the backend publishes `paypark/payment/paid`.
7. The kiosk browser polls `GET /api/payments/status` for live totals.
8. The local `serialPort` service only prints receipts and does not connect to MQTT.

## Topics

### `paypark/payment/open`

Published by the backend when a new payment session starts.

Example payload:

```text
1
```

### `paypark/payment/paying`

Published by the payment device to the broker.

Example payload:

```json
{
  "kioskId": "KIOSK-001",
  "amount": 5,
  "eventId": "1711362000000-ab12cd",
  "timestamp": "2026-03-25T09:00:00.000Z"
}
```

### `paypark/payment/paid`

Published by the backend when the active payment is complete.

Example payload:

```text
1
```

## Backend MQTT Configuration

The MQTT client should run on the backend server only.

Expected server environment variables:

```env
MQTT_URL=your-broker.s1.eu.hivemq.cloud
MQTT_PORT=8883
MQTT_USERNAME=your-username
MQTT_PASSWORD=your-password
```

This codebase also accepts lowercase legacy keys named `username` and `password`.

## Rollout Notes

- `/api/payments/webhook` is still present as a temporary compatibility path.
- The kiosk UI no longer uses MQTT directly.
- The `Not authorized` error was caused by the local kiosk-side service trying to connect to the broker; that service now stays printer-only.
- `paypark/payment/open` and `paypark/payment/paid` now publish plain scalar payloads instead of JSON objects.
- The current firmware still needs to consume `paypark/payment/paid` if the device must stop accepting coins immediately after payment.
