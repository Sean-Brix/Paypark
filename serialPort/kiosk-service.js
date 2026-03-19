/**
 * PAYPARK Kiosk Service
 * 
 * All-in-one service for:
 * - Arduino coin selector listening
 * - Receipt printing via thermal printer
 * 
 * Runs on localhost:3333
 * Runs on Windows kiosk machines
 * Can be packaged as executable with `pkg`
 */

import express from "express";
import pkg from "serialport";
import axios from "axios";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const { SerialPort } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── CONFIGURATION ─────────────────────────────────────────
const PORT = process.env.PAYPARK_SERVICE_PORT || 3333;
const WEBHOOK_URL = process.env.PAYPARK_WEBHOOK_URL || "https://paypark-656a.onrender.com/api/payments/webhook";
const COM_PORT = process.env.PAYPARK_COM_PORT || "COM7";
const BAUD_RATE = 9600;
const PRINTER_NAME = process.env.PAYPARK_PRINTER_NAME || "POS-58";
const PRINTER_DOTS = Number.parseInt(process.env.PAYPARK_DOTS || "384", 10);
const RECEIPT_CHARS = Number.parseInt(process.env.PAYPARK_COLUMNS || "32", 10);
const LOGO_MAX_DOTS = Number.parseInt(
  process.env.PAYPARK_LOGO_MAX_DOTS || String(Math.floor(PRINTER_DOTS * 0.56)),
  10
);
const LOGO_MAX_HEIGHT = Number.parseInt(process.env.PAYPARK_LOGO_MAX_HEIGHT || "92", 10);
const LOGO_THRESHOLD = Number.parseInt(process.env.PAYPARK_LOGO_THRESHOLD || "168", 10);
const LOGO_PATH = process.env.PAYPARK_LOGO_PATH || join(__dirname, "..", "src", "assets", "logo.png");

// ─── TEXT FORMATTING ───────────────────────────────────────
function fitText(text, width = RECEIPT_CHARS) {
  const value = String(text);
  if (value.length <= width) return value;
  if (width <= 1) return value.slice(0, width);
  return `${value.slice(0, width - 1)}.`;
}

function center(text, width = RECEIPT_CHARS) {
  const trimmed = String(text);
  if (trimmed.length >= width) return trimmed.slice(0, width);
  const left = Math.floor((width - trimmed.length) / 2);
  return `${" ".repeat(left)}${trimmed}`;
}

function line(left, right, width = RECEIPT_CHARS) {
  const maxLeft = Math.floor(width * 0.56);
  const l = fitText(left, maxLeft);
  const r = fitText(right, Math.max(1, width - l.length - 1));
  const spaces = Math.max(1, width - l.length - r.length);
  return `${l}${" ".repeat(spaces)}${r}`;
}

// ─── LOGO RASTERIZATION ─────────────────────────────────────
async function buildLogoRasterBytes(logoFilePath) {
  try {
    const input = readFileSync(logoFilePath);
    const meta = await sharp(input).metadata();
    if (!meta.width || !meta.height) throw new Error("Could not read logo dimensions");

    const targetWidth = Math.max(8, Math.min(PRINTER_DOTS, LOGO_MAX_DOTS, meta.width));
    const { data, info } = await sharp(input)
      .resize({
        width: targetWidth,
        height: LOGO_MAX_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
        kernel: sharp.kernel.nearest,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const targetHeight = info.height;
    const channels = info.channels;
    const widthBytes = Math.ceil(PRINTER_DOTS / 8);
    const rowData = Buffer.alloc(widthBytes * targetHeight, 0);
    const xOffset = Math.floor((PRINTER_DOTS - info.width) / 2);

    for (let y = 0; y < targetHeight; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const idx = (y * info.width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3] ?? 255;
        const alpha = a / 255;
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) * alpha + 255 * (1 - alpha);
        const isBlack = luminance < LOGO_THRESHOLD;

        if (isBlack) {
          const dstX = x + xOffset;
          const byteIndex = y * widthBytes + (dstX >> 3);
          const bitMask = 0x80 >> (dstX & 7);
          rowData[byteIndex] |= bitMask;
        }
      }
    }

    const xL = widthBytes & 0xff;
    const xH = (widthBytes >> 8) & 0xff;
    const yL = targetHeight & 0xff;
    const yH = (targetHeight >> 8) & 0xff;

    return Buffer.concat([
      Buffer.from([0x1b, 0x61, 0x01]),
      Buffer.from([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]),
      rowData,
      Buffer.from([0x0a, 0x1b, 0x61, 0x00]),
    ]);
  } catch (error) {
    console.warn(`Logo generation failed: ${error.message}`);
    return Buffer.alloc(0);
  }
}

async function buildEscPosReceipt(data) {
  const now = data.timestamp ? new Date(data.timestamp) : new Date();
  const divider = "-".repeat(RECEIPT_CHARS);
  const content = [
    center("PAYPARK"),
    center("Parking Receipt"),
    divider,
    line("Date", now.toLocaleDateString("en-CA")),
    line("Time", now.toLocaleTimeString("en-GB", { hour12: false })),
    line("Ticket", data.controlNumber),
    line("Vehicle", data.vehicleType),
    line("Amount", `PHP ${Number(data.amount).toFixed(2)}`),
    line("Status", "PAID"),
    divider,
    center(data.receiptHeader || "Thank you for parking!"),
    center(data.receiptFooter || "Drive safe."),
    "",
    "",
    "",
  ].join("\n");

  const init = Buffer.from([0x1b, 0x40]);
  const normal = Buffer.from([0x1b, 0x21, 0x00]);
  const text = Buffer.from(content, "ascii");
  const feed = Buffer.from([0x1b, 0x64, 0x03]);
  const cut = Buffer.from([0x1d, 0x56, 0x00]);

  let logo = Buffer.alloc(0);
  try {
    logo = await buildLogoRasterBytes(LOGO_PATH);
  } catch (error) {
    console.warn(`Logo skipped: ${error.message}`);
  }

  return Buffer.concat([init, normal, logo, text, feed, cut]);
}

// ─── POWERSHELL EXECUTION ──────────────────────────────────
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || error.message));
        return;
      }
      resolve((stdout || "").trim());
    });
  });
}

// ─── PRINT HANDLER ─────────────────────────────────────────
async function handlePrint(req, res) {
  try {
    const { vehicleType, amount, controlNumber, timestamp, receiptHeader, receiptFooter } = req.body;

    if (!vehicleType || !amount || !controlNumber) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: vehicleType, amount, controlNumber",
      });
    }

    const receiptData = { vehicleType, amount, controlNumber, timestamp, receiptHeader, receiptFooter };
    const binPath = join(tmpdir(), `paypark-receipt-${Date.now()}.bin`);
    const csPath = join(tmpdir(), "paypark-raw-printer-helper.cs");

    const receiptBuffer = await buildEscPosReceipt(receiptData);
    writeFileSync(binPath, receiptBuffer);

    // Write C# helper
    try {
      writeFileSync(
        csPath,
        [
          "using System;",
          "using System.Runtime.InteropServices;",
          "public static class RawPrinterHelper {",
          "  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]",
          "  public class DOCINFOA {",
          "    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;",
          "    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;",
          "    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;",
          "  }",
          "  [DllImport(\"winspool.Drv\", EntryPoint=\"OpenPrinterW\", SetLastError=true, CharSet=CharSet.Unicode)]",
          "  public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);",
          "  [DllImport(\"winspool.Drv\", EntryPoint=\"ClosePrinter\", SetLastError=true)]",
          "  public static extern bool ClosePrinter(IntPtr hPrinter);",
          "  [DllImport(\"winspool.Drv\", EntryPoint=\"StartDocPrinterW\", SetLastError=true, CharSet=CharSet.Unicode)]",
          "  public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 Level, [In] DOCINFOA pDocInfo);",
          "  [DllImport(\"winspool.Drv\", EntryPoint=\"EndDocPrinter\", SetLastError=true)]",
          "  public static extern bool EndDocPrinter(IntPtr hPrinter);",
          "  [DllImport(\"winspool.Drv\", EntryPoint=\"StartPagePrinter\", SetLastError=true)]",
          "  public static extern bool StartPagePrinter(IntPtr hPrinter);",
          "  [DllImport(\"winspool.Drv\", EntryPoint=\"EndPagePrinter\", SetLastError=true)]",
          "  public static extern bool EndPagePrinter(IntPtr hPrinter);",
          "  [DllImport(\"winspool.Drv\", EntryPoint=\"WritePrinter\", SetLastError=true)]",
          "  public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, Int32 dwCount, out Int32 dwWritten);",
          "}",
        ].join("\n"),
        "utf8"
      );
    } catch (error) {
      console.warn(`C# helper write failed: ${error.message}`);
    }

    try {
      const rawPs = [
        `Add-Type -Path '${csPath}' -ErrorAction SilentlyContinue`,
        `$bytes = [System.IO.File]::ReadAllBytes('${binPath}')`,
        "$h = [IntPtr]::Zero",
        `$ok = [RawPrinterHelper]::OpenPrinter('${PRINTER_NAME}', [ref]$h, [IntPtr]::Zero)`,
        "if (-not $ok) { throw 'OpenPrinter failed' }",
        "$doc = New-Object RawPrinterHelper+DOCINFOA",
        "$doc.pDocName = 'Paypark Receipt'",
        "$doc.pDataType = 'RAW'",
        "try {",
        "  $started = [RawPrinterHelper]::StartDocPrinter($h, 1, $doc)",
        "  if (-not $started) { throw 'StartDocPrinter failed' }",
        "  if (-not [RawPrinterHelper]::StartPagePrinter($h)) { throw 'StartPagePrinter failed' }",
        "  $written = 0",
        "  if (-not [RawPrinterHelper]::WritePrinter($h, $bytes, $bytes.Length, [ref]$written)) { throw 'WritePrinter failed' }",
        "  [RawPrinterHelper]::EndPagePrinter($h) | Out-Null",
        "  [RawPrinterHelper]::EndDocPrinter($h) | Out-Null",
        "  Write-Host ('RAW_PRINT_OK:' + $written)",
        "} finally {",
        "  if ($h -ne [IntPtr]::Zero) { [RawPrinterHelper]::ClosePrinter($h) | Out-Null }",
        "}",
      ].join("; ");

      const rawOut = await run("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", rawPs]);
      return res.json({ success: true, message: rawOut || `Printed receipt to ${PRINTER_NAME}` });
    } catch (rawErr) {
      console.warn(`Raw print failed: ${rawErr.message}`);
      return res.json({
        success: false,
        message: `Print failed: ${rawErr.message}. Receipt prepared but printer unavailable.`,
      });
    }
  } catch (error) {
    console.error("Print error:", error);
    res.status(500).json({ success: false, message: `Print error: ${error.message}` });
  }
}

// ─── COIN SELECTOR HANDLER ─────────────────────────────────
function mapValidCoinAmount(value) {
  const normalized = Number(value);
  if (normalized >= 5 && normalized <= 8) return 5.0;
  if (normalized >= 10 && normalized <= 13) return 10.0;
  if (normalized >= 20 && normalized <= 23) return 20.0;
  return 0.0;
}

function parseCoinCandidate(line) {
  const amountMatch = line.match(/^Amount:\s*PHP\s*([0-9]+(?:\.[0-9]+)?)$/i);
  if (amountMatch) return Number.parseFloat(amountMatch[1]);

  const pulsesMatch = line.match(/^Pulses:\s*(\d+)$/i);
  if (pulsesMatch) return Number.parseInt(pulsesMatch[1], 10);

  const numericLineMatch = line.match(/^\d+(?:\.\d+)?$/);
  if (numericLineMatch) return Number.parseFloat(line);

  return null;
}

async function startArduinoListener() {
  try {
    const port = new SerialPort({ path: COM_PORT, baudRate: BAUD_RATE });

    let buffer = "";

    port.on("data", async (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || /^READY$/i.test(line) || /^Unknown coin$/i.test(line)) continue;

        const candidate = parseCoinCandidate(line);
        if (candidate === null) continue;

        const coinAmount = mapValidCoinAmount(candidate);
        if (coinAmount <= 0) {
          console.log(`Ignored invalid coin: ${candidate}`);
          continue;
        }

        try {
          const response = await axios.post(WEBHOOK_URL, { coinAmount });
          console.log(`[COIN] ${coinAmount} PHP → Server OK: ${response.status}`);
        } catch (error) {
          const msg = error.response ? `Server: ${error.response.status}` : error.message;
          console.error(`[COIN] ${coinAmount} PHP → Failed: ${msg}`);
        }
      }
    });

    port.on("error", (err) => {
      console.error(`[SERIAL] Error: ${err.message}`);
    });

    console.log(`✓ Arduino listener started on ${COM_PORT}`);
  } catch (error) {
    console.error(`[SERIAL] Failed to start: ${error.message}`);
    console.error(`[SERIAL] Check COM port (default: ${COM_PORT}) or set PAYPARK_COM_PORT`);
  }
}

// ─── EXPRESS SERVER ────────────────────────────────────────
const app = express();
app.use(express.json());

app.post("/print/receipt", handlePrint);

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "paypark-kiosk", port: PORT });
});

app.listen(PORT, () => {
  console.log(`\n════════════════════════════════════════════════════`);
  console.log(`  PAYPARK KIOSK SERVICE`);
  console.log(`════════════════════════════════════════════════════`);
  console.log(`  Port:     http://localhost:${PORT}`);
  console.log(`  Printer:  ${PRINTER_NAME}`);
  console.log(`  Status:   Ready`);
  console.log(`════════════════════════════════════════════════════\n`);

  startArduinoListener();
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n✓ Shutting down...");
  process.exit(0);
});
