/**
 * Print Controller
 * Handles receipt printing to thermal printers via ESC/POS
 */

import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync } from "node:fs";

const printerName = process.env.PAYPARK_PRINTER_NAME || "POS-58";
const receiptChars = Number.parseInt(process.env.PAYPARK_COLUMNS || "32", 10);
const defaultReceiptTitle = "CVSU-CCAT PAY-PARKING";
const defaultReceiptFooter = "Thank You!";
const receiptCopies = ["GUARD COPY", "DRIVER COPY"];

function fitText(text, width = receiptChars) {
  const value = String(text);
  if (value.length <= width) {
    return value;
  }
  if (width <= 1) {
    return value.slice(0, width);
  }
  return `${value.slice(0, width - 1)}.`;
}

function center(text, width = receiptChars) {
  const trimmed = String(text);
  if (trimmed.length >= width) {
    return trimmed.slice(0, width);
  }
  const left = Math.floor((width - trimmed.length) / 2);
  return `${" ".repeat(left)}${trimmed}`;
}

function line(left, right, width = receiptChars) {
  const maxLeft = Math.floor(width * 0.56);
  const l = fitText(left, maxLeft);
  const r = fitText(right, Math.max(1, width - l.length - 1));
  const spaces = Math.max(1, width - l.length - r.length);
  return `${l}${" ".repeat(spaces)}${r}`;
}

function resolveReceiptTitle(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed || /^paypark$/i.test(trimmed)) {
    return defaultReceiptTitle;
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
    return defaultReceiptFooter;
  }

  return trimmed;
}

function buildReceiptCopyText(data, copyLabel) {
  const divider = "-".repeat(receiptChars);
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
  return receiptCopies
    .map((copyLabel) => buildReceiptCopyText(data, copyLabel))
    .join("\n\n\n");
}

async function buildEscPosReceipt(data) {
  const receiptText = buildReceiptText(data);

  const init = Buffer.from([0x1b, 0x40]);
  const normal = Buffer.from([0x1b, 0x21, 0x00]);
  const lineSpacing = Buffer.from([0x1b, 0x33, 0x20]);
  const text = Buffer.from(`${receiptText}\n\n`, "ascii");
  const feed = Buffer.from([0x1b, 0x64, 0x03]);
  const cut = Buffer.from([0x1d, 0x56, 0x00]);

  return Buffer.concat([init, normal, lineSpacing, text, feed, cut]);
}

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

export async function printReceipt(req, res) {
  try {
    const { vehicleType, amount, controlNumber, timestamp, receiptHeader, receiptFooter } = req.body;

    if (!vehicleType || !amount || !controlNumber) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: vehicleType, amount, controlNumber",
      });
    }

    const receiptData = {
      vehicleType,
      amount,
      controlNumber,
      timestamp,
      receiptHeader,
      receiptFooter,
    };

    const binPath = join(tmpdir(), `paypark-receipt-${Date.now()}.bin`);
    const csPath = join(tmpdir(), "paypark-raw-printer-helper.cs");
    const txtPath = join(tmpdir(), `paypark-receipt-${Date.now()}.txt`);

    // Build receipt bytes
    const receiptBuffer = await buildEscPosReceipt(receiptData);
    writeFileSync(binPath, receiptBuffer);

    // Write C# helper (only if not already present)
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
      // Try raw print (Windows only)
      const rawPs = [
        `Add-Type -Path '${csPath}' -ErrorAction SilentlyContinue`,
        `$bytes = [System.IO.File]::ReadAllBytes('${binPath}')`,
        "$h = [IntPtr]::Zero",
        `$ok = [RawPrinterHelper]::OpenPrinter('${printerName}', [ref]$h, [IntPtr]::Zero)`,
        "if (-not $ok) { throw 'OpenPrinter failed' }",
        "$doc = New-Object RawPrinterHelper+DOCINFOA",
        "$doc.pDocName = 'Paypark Receipt'",
        "$doc.pDataType = 'RAW'",
        "$started = $false",
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

      const rawOut = await run("powershell", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        rawPs,
      ]);

      return res.json({
        success: true,
        message: rawOut || `Printed receipt to ${printerName}`,
      });
    } catch (rawErr) {
      console.warn(`Raw print failed: ${rawErr.message}. Trying fallback.`);

      // Fallback: Out-Printer
      try {
        const fallbackContent = buildReceiptText({
          vehicleType,
          amount,
          controlNumber,
          timestamp,
          receiptHeader,
          receiptFooter,
        });

        writeFileSync(txtPath, fallbackContent, "ascii");

        const ps = [
          `Get-Content '${txtPath}' | Out-Printer -Name '${printerName}'`,
          `Write-Host 'Fallback print completed to ${printerName}'`,
        ].join("; ");

        const fallbackOut = await run("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps]);

        return res.json({
          success: true,
          message: fallbackOut || `Printed via fallback to ${printerName}`,
        });
      } catch (fallbackErr) {
        return res.json({
          success: false,
          message: `Print failed: ${fallbackErr.message}. Receipt data prepared but printer unavailable.`,
        });
      }
    }
  } catch (error) {
    console.error("Print error:", error);
    res.status(500).json({
      success: false,
      message: `Print error: ${error.message}`,
    });
  }
}
