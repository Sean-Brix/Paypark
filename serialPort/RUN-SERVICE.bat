@echo off
REM PAYPARK Local Printer Service Launcher
REM Double-click this file to start the receipt printer service.

setlocal

REM Configuration
set PAYPARK_PRINTER_NAME=POS-58
set PAYPARK_SERVICE_PORT=3333

REM Optional: set PAYPARK_LOGO_PATH=C:\path\to\logo.png

echo.
echo ========================================
echo PAYPARK LOCAL PRINTER SERVICE
echo ========================================
echo Printer: %PAYPARK_PRINTER_NAME%
echo Service: http://localhost:%PAYPARK_SERVICE_PORT%
echo.
echo Starting service... Press Ctrl+C to stop.
echo.

powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %PAYPARK_SERVICE_PORT% -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne 0 } | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

node "%~dp0kiosk-service.js"

pause
