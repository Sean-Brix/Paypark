# PAYPARK Local Printer Service

This local Windows service is now printer-only.

It handles:
- Receipt printing over `http://localhost:3333/print/receipt`
- Basic health checks over `http://localhost:3333/health`

It no longer:
- Connects to MQTT
- Reads Arduino or ESP32 coin input
- Sends payment data to the backend

The payment device now talks to the online MQTT broker, and the backend server is the only part of the system that connects to MQTT.

## Quick Start

1. Open a terminal in `serialPort`
2. Run `npm install`
3. Run `npm start`

Or double-click `RUN-SERVICE.bat`.

## Configuration

Supported environment variables:

```bat
set PAYPARK_PRINTER_NAME=POS-58
set PAYPARK_SERVICE_PORT=3333
set PAYPARK_LOGO_PATH=C:\path\to\logo.png
set PAYPARK_LOGO_MAX_DOTS=215
set PAYPARK_LOGO_MAX_HEIGHT=92
set PAYPARK_LOGO_THRESHOLD=168
set PAYPARK_COLUMNS=32
set PAYPARK_DOTS=384
```

## API

### `GET /health`

Example response:

```json
{
  "status": "ok",
  "service": "paypark-kiosk-printer",
  "port": 3333,
  "printer": "POS-58"
}
```

### `POST /print/receipt`

Example request:

```json
{
  "vehicleType": "Car",
  "amount": 50,
  "controlNumber": "ESP-ACTIVE-1711362000000-321",
  "timestamp": "2026-03-25T09:00:05.000Z",
  "receiptHeader": "Thank you for parking!",
  "receiptFooter": "Drive safe."
}
```

## Notes

- The browser still tries the local printer service first for receipt printing.
- If the local service is unavailable, the frontend falls back to the backend print endpoint.
- If MQTT shows `Not authorized`, check the backend server configuration, not this local printer service.
