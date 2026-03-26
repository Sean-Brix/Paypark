import express from "express";
import { execFile } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = Number.parseInt(process.env.PAYPARK_SERVICE_PORT || "3333", 10);
const PRINTER_NAME = process.env.PAYPARK_PRINTER_NAME || "POS-58";
const RECEIPT_CHARS = Number.parseInt(process.env.PAYPARK_COLUMNS || "32", 10);
const DEFAULT_RECEIPT_TITLE = "CVSU-CCAT PAY-PARKING";
const DEFAULT_RECEIPT_FOOTER = "Thank You!";
const RECEIPT_COPIES = ["GUARD COPY", "DRIVER COPY"];

function fitText(text, width = RECEIPT_CHARS) {
  const value = String(text);

  if (value.length <= width) {
    return value;
  }

  if (width <= 1) {
    return value.slice(0, width);
  }

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

function resolveReceiptTitle(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed || /^paypark$/i.test(trimmed)) {
    return DEFAULT_RECEIPT_TITLE;
  }

  return trimmed.toUpperCase();
}

function resolveReceiptFooter(value) {
  const trimmed = String(value || "").trim();

  if (
    !trimmed ||
    /^thank you for parking with us$/i.test(trimmed) ||
    /^drive safe\.?$/i.test(trimmed) ||
    /^drive safely\.?$/i.test(trimmed)
  ) {
    return DEFAULT_RECEIPT_FOOTER;
  }

  return trimmed;
}

function buildReceiptCopyText(data, copyLabel) {
  const divider = "-".repeat(RECEIPT_CHARS);
  const amountText = Number(data.amount).toFixed(2);

  return [
    center(resolveReceiptTitle(data.receiptHeader)),
    divider,
    line("AMOUNT:", amountText),
    "",
    "CONTROL NUMBER:",
    center(data.controlNumber),
    divider,
    center(copyLabel),
    center(resolveReceiptFooter(data.receiptFooter)),
  ].join("\n");
}

function buildReceiptText(data) {
  return RECEIPT_COPIES
    .map((copyLabel) => buildReceiptCopyText(data, copyLabel))
    .join("\n\n\n");
}

function buildEscPosReceipt(data) {
  const content = buildReceiptText(data);
  const init = Buffer.from([0x1b, 0x40]);
  const normal = Buffer.from([0x1b, 0x21, 0x00]);
  const lineSpacing = Buffer.from([0x1b, 0x33, 0x20]);
  const text = Buffer.from(`${content}\n\n`, "ascii");
  const feed = Buffer.from([0x1b, 0x64, 0x03]);
  const cut = Buffer.from([0x1d, 0x56, 0x00]);

  return Buffer.concat([init, normal, lineSpacing, text, feed, cut]);
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

    const receiptBuffer = buildEscPosReceipt({
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
