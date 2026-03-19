# PAYPARK Kiosk Service

Standalone Windows service for the kiosk machine. Handles:
- **Arduino Coin Selector**: Listens to serial port and reports coins to the backend
- **Thermal Receipt Printing**: Prints receipts to POS-58 printer immediately after payment

## Quick Start (No Setup Required)

### Install & Run

1. Install Node.js (https://nodejs.org/) if not already installed
2. Run these commands:
   ```bash
   cd serialPort
   npm install
   npm start
   ```
3. Service listens on `http://localhost:3333`

### Easier: Use the .bat File

After `npm install`, just double-click `RUN-SERVICE.bat`:
- Automatically sets up environment variables
- Shows service status
- Press Ctrl+C to stop

### Auto-Start with Windows

**Option 1: Startup Folder (Simple)**
1. Press `Win + R`, type `shell:startup`
2. Copy `paypark-kiosk-service.exe` shortcut here
3. Service auto-starts on login

**Option 2: Task Scheduler (Advanced)**
1. Open Task Scheduler
2. Create Basic Task → "PAYPARK Kiosk Service"
3. Trigger: "At startup"
4. Action: Start program → `paypark-kiosk-service.exe`
5. Check "Run whether user is logged in or not"

## Configuration

Set environment variables before running:

```bash
# COM port for Arduino (default: COM7)
set PAYPARK_COM_PORT=COM3

# Printer name (default: POS-58)
set PAYPARK_PRINTER_NAME=POS-58

# Service port (default: 3333)
set PAYPARK_SERVICE_PORT=3333

# Backend webhook URL (default: Render.com)
set PAYPARK_WEBHOOK_URL=https://your-backend.com/api/payments/webhook

# Logo path (optional, for printer)
set PAYPARK_LOGO_PATH=C:\path\to\logo.png

paypark-kiosk-service.exe
```

Or create a `.bat` wrapper:

```batch
@echo off
set PAYPARK_COM_PORT=COM3
set PAYPARK_PRINTER_NAME=POS-58
set PAYPARK_SERVICE_PORT=3333
paypark-kiosk-service.exe
pause
```

## API Endpoints

### Health Check
```
GET http://localhost:3333/health
Response: { "status": "ok", "service": "paypark-kiosk", "port": 3333 }
```

### Print Receipt
```
POST http://localhost:3333/print/receipt
Content-Type: application/json

Body:
{
  "vehicleType": "Car",
  "amount": 50.00,
  "controlNumber": "CTRL-12345",
  "timestamp": "2026-03-19T10:30:00Z",
  "receiptHeader": "Thank you for parking!",
  "receiptFooter": "Drive safely"
}

Response: { "success": true, "message": "..." }
```

## Troubleshooting

### Arduino Not Detected
- Check COM port: Device Manager → Ports (COM & LPT)
- Verify Arduino is connected to USB
- Update PAYPARK_COM_PORT if needed

### Printer Not Found
- Check printer name: Settings → Devices → Printers & Scanners
- Ensure POS-58 is set as default printer
- Verify USB connection

### Service Won't Start
- Check Windows Firewall (allow port 3333)
- Ensure no other service uses port 3333
- Run as Administrator if permission denied

### Logo Missing
- Ensure logo.png exists at specified path
- Receipt will print without logo if file not found (no error)

## Logs

The service prints all events to console:
- `[COIN]` - Coins detected from Arduino
- `[SERIAL]` - Serial port events
- `[PRINT]` - Receipt printing status

Redirect to file for persistent logs:
```bash
paypark-kiosk-service.exe > kiosk-service.log 2>&1
```

## PWA Integration

The hosted PWA calls this service at `http://localhost:3333/print/receipt` automatically after payment completes. No manual configuration needed if the PWA points to your hosted backend.

## Support

Issues or questions? Check:
1. Port 3333 is accessible: `curl http://localhost:3333/health`
2. Arduino serial connection: `Get-Content COM7 -Wait` (PowerShell)
3. Printer queue: Settings → Devices → Printers & Scanners
