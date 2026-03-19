@echo off
REM PAYPARK Kiosk Service Launcher
REM Double-click this file to start the service with default settings

setlocal enabledelayedexpansion

REM ═══════════════════════════════════════════════════════════
REM CONFIGURATION - Edit these if needed
REM ═══════════════════════════════════════════════════════════

REM Serial port for Arduino (check Device Manager → Ports)
set PAYPARK_COM_PORT=COM7

REM Printer name (check Settings → Printers & Scanners)
set PAYPARK_PRINTER_NAME=POS-58

REM Service port (where the kiosk service listens)
set PAYPARK_SERVICE_PORT=3333

REM Backend webhook URL (for coin selector events)
set PAYPARK_WEBHOOK_URL=https://paypark-656a.onrender.com/api/payments/webhook

REM Optional: Logo path (leave empty to disable)
REM set PAYPARK_LOGO_PATH=C:\path\to\logo.png

REM ═══════════════════════════════════════════════════════════

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                PAYPARK KIOSK SERVICE                      ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo  Configuration:
echo  ├─ Arduino Port:  %PAYPARK_COM_PORT%
echo  ├─ Printer:       %PAYPARK_PRINTER_NAME%
echo  ├─ Service Port:  http://localhost:%PAYPARK_SERVICE_PORT%
echo  └─ Backend:       %PAYPARK_WEBHOOK_URL%
echo.
echo  Starting service... Press Ctrl+C to stop.
echo.

REM ═══════════════════════════════════════════════════════════
REM Clean up any previous instances using port 3333
REM ═══════════════════════════════════════════════════════════

REM Use PowerShell to kill any process using port 3333
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %PAYPARK_SERVICE_PORT% -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne 0 } | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

REM Run the service with Node.js
node "%~dp0kiosk-service.js"

REM If service crashes or ends, show this message
pause
