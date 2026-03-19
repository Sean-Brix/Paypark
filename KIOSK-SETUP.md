# PAYPARK Kiosk Setup Guide

Complete setup instructions for running PAYPARK on a Windows kiosk machine with local printing and coin selector.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Browser (Windows)                       │
│  ┌────────────────────────────────────┐                │
│  │   PAYPARK PWA App                  │                │
│  │ (from your hosted backend)         │                │
│  └────────────┬───────────────────────┘                │
│               │ HTTPS                                   │
│               ▼                                         │
│  ┌────────────────────────────────────┐                │
│  │   Hosted Backend (Transactions)    │                │
│  │   example.com/api                  │                │
│  └────────────────────────────────────┘                │
│                                                         │
│  ┌────────────────────────────────────┐                │
│  │   Local Kiosk Service              │                │
│  │   http://localhost:3333            │  ◄── USB/COM   │
│  │   (Print + Arduino Listener)       │─────────────┐  │
│  └────────────────────────────────────┘             │  │
└──────────────────────────────────────────────────────┼──┘
                                                       │
                ┌──────────────────────────────────────┴──┐
                │                                         │
         ┌──────▼──────┐                        ┌────────▼────┐
         │   Arduino    │                        │   Printer   │
         │ Coin Selector│                        │  (POS-58)   │
         └─────────────┘                        └─────────────┘
```

## Prerequisites

- Windows 10 or later
- Node.js 18+ (https://nodejs.org/)
- USB Thermal Printer (POS-58 or compatible)
- Arduino Coin Selector (USB connected)
- Internet connection for hosted backend

## Setup Steps

### Step 1: Prepare Kiosk Machine

1. Install Node.js from https://nodejs.org/
   - Choose LTS version
   - Use default installation settings
   - Check "Add to PATH"

2. Connect USB devices
   - Plug in thermal printer
   - Plug in Arduino coin selector
   - Wait for Windows to detect devices

3. Verify connections
   - Open Device Manager
   - Check "Ports (COM & LPT)" for Arduino COM port (e.g., COM7)
   - Check "Printers & Scanners" for printer name (e.g., POS-58)

### Step 2: Download/Build Kiosk Service

#### Option A: Use Pre-Built Executable (Easiest)

1. Download latest `paypark-kiosk-service.exe` from releases
2. Save to Desktop or a permanent folder
3. Skip to Step 3

#### Option B: Build From Source

1. Open Command Prompt or PowerShell
2. Navigate to the serialPort folder:
   ```bash
   cd C:\Users\YourName\Desktop\CODE\Paypark\serialPort
   ```

3. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

This creates `paypark-kiosk-service.exe`

### Step 3: Configure Service

Edit `RUN-SERVICE.bat` with your settings:

```batch
REM Update these values from Step 1 verification
set PAYPARK_COM_PORT=COM7          ← Your Arduino port
set PAYPARK_PRINTER_NAME=POS-58    ← Your printer name
set PAYPARK_SERVICE_PORT=3333      ← Keep as-is (default)
set PAYPARK_WEBHOOK_URL=https://your-backend.com/api/payments/webhook
```

### Step 4: Test the Service

1. Double-click `RUN-SERVICE.bat`
2. Should show:
   ```
   ════════════════════════════════════════════════════
     PAYPARK KIOSK SERVICE
   ════════════════════════════════════════════════════
     Port:     http://localhost:3333
     Printer:  POS-58
     Status:   Ready
   ════════════════════════════════════════════════════
   
   ✓ Arduino listener started on COM7
   ```

3. Keep this window open

4. Open browser and test:
   ```
   http://localhost:3333/health
   ```
   Should return: `{"status":"ok","service":"paypark-kiosk","port":3333}`

### Step 5: Test Printing

1. Using the service running, make a test request:
   ```bash
   curl -X POST http://localhost:3333/print/receipt ^
     -H "Content-Type: application/json" ^
     -d "{\"vehicleType\":\"Car\",\"amount\":50.00,\"controlNumber\":\"TEST-001\",\"timestamp\":\"2026-03-19T10:30:00Z\"}"
   ```

2. Receipt should print to POS-58

3. If printer not found, check Device Manager and update `PAYPARK_PRINTER_NAME`

### Step 6: Auto-Start with Windows

#### Method 1: Startup Folder (Simplest)

1. Press `Win + R`
2. Type: `shell:startup`
3. Create shortcut of `RUN-SERVICE.bat` here
4. Shortcut auto-runs when you login

#### Method 2: Task Scheduler

1. Press `Win + R`
2. Type: `taskschd.msc`
3. Right-click "Task Scheduler" → "Create Basic Task"
4. Name: "PAYPARK Kiosk Service"
5. Trigger: "At startup"
6. Action: "Start a program"
   - Program: `C:\path\to\RUN-SERVICE.bat`
   - Start in: `C:\path\to\folder\containing\bat`
7. Check "Run whether user is logged in or not"
8. Finish

#### Method 3: Windows Service (Advanced)

For production deployments, use NSSM (Non-Sucking Service Manager):
```bash
nssm install PayParkKiosk C:\path\to\RUN-SERVICE.bat
nssm start PayParkKiosk
```

### Step 7: Configure PWA

Your hosted PWA already points to `http://localhost:3333` for printing. Just ensure:

1. PWA is accessed on the kiosk via browser
   - Open Edge/Chrome at `https://your-backend.com`
   - Or open localhost PWA if running locally

2. Service is running before using the kiosk

3. Kiosk service port (3333) is NOT blocked by firewall

## Testing Payment Flow

1. **Service Running**: Check terminal shows "Ready"
2. **Open PWA**: Navigate to your hosted PAYPARK app in browser
3. **Select Vehicle**: Choose car/bike/etc. in kiosk view
4. **Simulate Coins**: Arduino will trigger coin events to local service
   - Service logs: `[COIN] 50 PHP → Server OK: 200`
5. **Payment Complete**: Receipt prints automatically
6. **Check Logs**: Look for `[PRINT]` log messages

## Troubleshooting

### Service won't start
```bash
# Check Node.js installed
node --version

# Check npm works
npm --version

# Try running directly
cd path\to\serialPort
npm start
```

### Arduino not detected
```powershell
# List COM ports
Get-WmiObject Win32_SerialPort | Select-Object Name, Description

# Try opening COM port (replace COM7)
[System.IO.Ports.SerialPort]::new("COM7", 9600).Open()
```

### Printer not found
```powershell
# List installed printers
Get-Printer | Select-Object Name

# Set default
Set-PrinterAsDefault -Name "POS-58"
```

### Port 3333 already in use
```powershell
# Find process using port 3333
Get-NetTCPConnection -LocalPort 3333 | Select-Object OwningProcess

# Kill process (replace PID)
Stop-Process -Id 1234 -Force

# Or change PAYPARK_SERVICE_PORT to different port
```

### Cross-origin errors in PWA
- Ensure service is running before opening PWA
- Check firewall allows localhost:3333
- Verify no VPN blocking local connections

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PAYPARK_COM_PORT` | COM7 | Arduino serial port |
| `PAYPARK_PRINTER_NAME` | POS-58 | Thermal printer name |
| `PAYPARK_SERVICE_PORT` | 3333 | Local service port |
| `PAYPARK_WEBHOOK_URL` | Render.com URL | Backend webhook for coins |
| `PAYPARK_LOGO_PATH` | src/assets/logo.png | Logo for receipts |
| `PAYPARK_LOGO_MAX_DOTS` | 215 | Logo width in printer dots |
| `PAYPARK_LOGO_MAX_HEIGHT` | 92 | Logo height in pixels |
| `PAYPARK_LOGO_THRESHOLD` | 168 | Logo contrast threshold |
| `PAYPARK_COLUMNS` | 32 | Receipt characters per line |
| `PAYPARK_DOTS` | 384 | Printer width (58mm) |

## Production Deployment Checklist

- [ ] Service auto-starts with Windows
- [ ] Logo path configured and accessible
- [ ] Printer tested and working
- [ ] Arduino coin selector calibrated
- [ ] Service port not blocked by firewall
- [ ] Backend webhook URL verified
- [ ] PWA loads correctly on kiosk
- [ ] Test payment → receipt prints end-to-end
- [ ] Backup laptop has same setup for redundancy

## Contact & Support

Issues? Check:
1. Service logs (look for errors)
2. Windows Event Viewer (System logs)
3. Device Manager (hardware detection)
4. Backend logs (coin events)
