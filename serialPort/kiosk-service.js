import express from "express";
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = Number.parseInt(process.env.PAYPARK_SERVICE_PORT || "3333", 10);
const PRINTER_NAME = process.env.PAYPARK_PRINTER_NAME || "POS-58";
const PRINTER_DOTS = Number.parseInt(process.env.PAYPARK_DOTS || "384", 10);
const RECEIPT_CHARS = Number.parseInt(process.env.PAYPARK_COLUMNS || "32", 10);
const LOGO_MAX_DOTS = Number.parseInt(
  process.env.PAYPARK_LOGO_MAX_DOTS || String(Math.floor(PRINTER_DOTS * 0.56)),
  10
);
const LOGO_MAX_HEIGHT = Number.parseInt(
  process.env.PAYPARK_LOGO_MAX_HEIGHT || "92",
  10
);
const LOGO_THRESHOLD = Number.parseInt(
  process.env.PAYPARK_LOGO_THRESHOLD || "168",
  10
);
const LOGO_PATH =
  process.env.PAYPARK_LOGO_PATH ||
  join(__dirname, "..", "src", "assets", "logo.png");

function fitText(text, width = RECEIPT_CHARS) {
  const value = String(text);
  if (value.length <= width) return value;
  if (width <= 1) return value.slice(0, width);
  return `${value.slice(0, width - 1)}.`;
}

function center(text, width = RECEIPT_CHARS) {
  const value = String(text);
  if (value.length >= width) {
    return value.slice(0, width);
  }

  const leftPadding = Math.floor((width - value.length) / 2);
  return `${" ".repeat(leftPadding)}${value}`;
}

function line(left, right, width = RECEIPT_CHARS) {
  const maxLeft = Math.floor(width * 0.56);
  const leftText = fitText(left, maxLeft);
  const rightText = fitText(right, Math.max(1, width - leftText.length - 1));
  const spaces = Math.max(1, width - leftText.length - rightText.length);
  return `${leftText}${" ".repeat(spaces)}${rightText}`;
}

async function buildLogoRasterBytes(logoFilePath) {
  try {
    const input = readFileSync(logoFilePath);
    const metadata = await sharp(input).metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Could not read logo dimensions");
    }

    const targetWidth = Math.max(
      8,
      Math.min(PRINTER_DOTS, LOGO_MAX_DOTS, metadata.width)
    );

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

    const widthBytes = Math.ceil(PRINTER_DOTS / 8);
    const rowData = Buffer.alloc(widthBytes * info.height, 0);
    const xOffset = Math.floor((PRINTER_DOTS - info.width) / 2);

    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const index = (y * info.width + x) * info.channels;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3] ?? 255;
        const alpha = a / 255;
        const luminance =
          (0.299 * r + 0.587 * g + 0.114 * b) * alpha + 255 * (1 - alpha);

        if (luminance < LOGO_THRESHOLD) {
          const destinationX = x + xOffset;
          const byteIndex = y * widthBytes + (destinationX >> 3);
          const bitMask = 0x80 >> (destinationX & 7);
          rowData[byteIndex] |= bitMask;
        }
      }
    }

    const xL = widthBytes & 0xff;
    const xH = (widthBytes >> 8) & 0xff;
    const yL = info.height & 0xff;
    const yH = (info.height >> 8) & 0xff;

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

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || error.message));
        return;
      }

      resolve((stdout || "").trim());
    });
  });
}

async function handlePrint(req, res) {
  try {
    const { vehicleType, amount, controlNumber, timestamp, receiptHeader, receiptFooter } =
      req.body;

    if (!vehicleType || !amount || !controlNumber) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: vehicleType, amount, controlNumber",
      });
    }

    const receiptBuffer = await buildEscPosReceipt({
      vehicleType,
      amount,
      controlNumber,
      timestamp,
      receiptHeader,
      receiptFooter,
    });

    const binPath = join(tmpdir(), `paypark-receipt-${Date.now()}.bin`);
    const csPath = join(tmpdir(), "paypark-raw-printer-helper.cs");
    writeFileSync(binPath, receiptBuffer);

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
        "  public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In] DOCINFOA pDocInfo);",
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

    try {
      const rawPrintScript = [
        `Add-Type -Path '${csPath}' -ErrorAction SilentlyContinue`,
        `$bytes = [System.IO.File]::ReadAllBytes('${binPath}')`,
        "$handle = [IntPtr]::Zero",
        `$opened = [RawPrinterHelper]::OpenPrinter('${PRINTER_NAME}', [ref]$handle, [IntPtr]::Zero)`,
        "if (-not $opened) { throw 'OpenPrinter failed' }",
        "$doc = New-Object RawPrinterHelper+DOCINFOA",
        "$doc.pDocName = 'Paypark Receipt'",
        "$doc.pDataType = 'RAW'",
        "try {",
        "  $started = [RawPrinterHelper]::StartDocPrinter($handle, 1, $doc)",
        "  if (-not $started) { throw 'StartDocPrinter failed' }",
        "  if (-not [RawPrinterHelper]::StartPagePrinter($handle)) { throw 'StartPagePrinter failed' }",
        "  $written = 0",
        "  if (-not [RawPrinterHelper]::WritePrinter($handle, $bytes, $bytes.Length, [ref]$written)) { throw 'WritePrinter failed' }",
        "  [RawPrinterHelper]::EndPagePrinter($handle) | Out-Null",
        "  [RawPrinterHelper]::EndDocPrinter($handle) | Out-Null",
        "  Write-Host ('RAW_PRINT_OK:' + $written)",
        "} finally {",
        "  if ($handle -ne [IntPtr]::Zero) { [RawPrinterHelper]::ClosePrinter($handle) | Out-Null }",
        "}",
      ].join("; ");

      const output = await runCommand("powershell", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        rawPrintScript,
      ]);

      return res.json({
        success: true,
        message: output || `Printed receipt to ${PRINTER_NAME}`,
      });
    } catch (error) {
      console.warn(`Raw print failed: ${error.message}`);
      return res.json({
        success: false,
        message: `Print failed: ${error.message}. Receipt prepared but printer unavailable.`,
      });
    }
  } catch (error) {
    console.error("Print error:", error);
    return res.status(500).json({
      success: false,
      message: `Print error: ${error.message}`,
    });
  }
}

const app = express();

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Private-Network", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json());
app.post("/print/receipt", handlePrint);

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "paypark-kiosk-printer",
    port: PORT,
    printer: PRINTER_NAME,
  });
});

const server = app.listen(PORT, () => {
  console.log("");
  console.log("========================================");
  console.log("PAYPARK LOCAL PRINTER SERVICE");
  console.log("========================================");
  console.log(`Port:    http://localhost:${PORT}`);
  console.log(`Printer: ${PRINTER_NAME}`);
  console.log("Status:  Ready");
  console.log("========================================");
  console.log("");
});

function shutdown() {
  console.log("Shutting down printer service...");
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
