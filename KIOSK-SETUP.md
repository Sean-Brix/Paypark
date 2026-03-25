# PAYPARK Kiosk Setup Guide

This setup now uses server-only MQTT.

## Architecture

- Browser kiosk UI -> HTTP -> backend server
- Payment device -> MQTT -> online broker
- Backend server -> MQTT -> online broker
- Browser kiosk UI -> HTTP -> local printer service

The local `serialPort` service is printer-only. It does not connect to MQTT and it does not read coin data anymore.

## Payment Flow

1. The kiosk UI starts a payment with `POST /api/payments/session`.
2. The backend publishes `paypark/payment/open` with a plain payload of `1`.
3. The payment device opens the coin selector after receiving that message.
4. The payment device publishes coin events to `paypark/payment/paying`.
5. The backend subscribes to that topic and updates the active transaction.
6. The browser polls `GET /api/payments/status` to show inserted and remaining amounts.
7. When the payment is complete, the backend publishes `paypark/payment/paid` with a plain payload of `1`.
8. The device should stop accepting coins after receiving the paid message.
9. The browser calls the local printer service on `http://localhost:3333/print/receipt`.

## Local Printer Service Setup

1. Open a terminal in `serialPort`
2. Run `npm install`
3. Run `npm start`

Or double-click `serialPort/RUN-SERVICE.bat`.

Default local printer service settings:

```bat
set PAYPARK_PRINTER_NAME=POS-58
set PAYPARK_SERVICE_PORT=3333
```

Optional logo settings:

```bat
set PAYPARK_LOGO_PATH=C:\path\to\logo.png
set PAYPARK_LOGO_MAX_DOTS=215
set PAYPARK_LOGO_MAX_HEIGHT=92
set PAYPARK_LOGO_THRESHOLD=168
```

## Backend MQTT Setup

Configure MQTT on the backend server only.

Example variables:

```env
MQTT_URL=your-broker.s1.eu.hivemq.cloud
MQTT_PORT=8883
MQTT_USERNAME=your-username
MQTT_PASSWORD=your-password
```

This backend also accepts the legacy keys `username` and `password`.

If you see `Connection refused: Not authorized`, verify the server MQTT username carefully because HiveMQ usernames are case-sensitive.

## Health Checks

- Local printer service: `GET http://localhost:3333/health`
- Backend server: `GET /api/health`

## Important Notes

- The browser no longer needs an MQTT client.
- The printer service no longer needs MQTT credentials.
- The printer service no longer needs Arduino or ESP32 serial access.
- `/api/payments/webhook` still exists temporarily for backward compatibility.
- If the device must stop accepting coins immediately, its firmware still needs to subscribe to `paypark/payment/paid`.
