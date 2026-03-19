import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import sharp from "sharp";

const printerName = process.env.PAYPARK_PRINTER_NAME || "POS-58";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logoPath = process.env.PAYPARK_LOGO_PATH || join(__dirname, "src", "assets", "logo.png");
const printerDots = Number.parseInt(process.env.PAYPARK_DOTS || "384", 10);
const receiptChars = Number.parseInt(process.env.PAYPARK_COLUMNS || "32", 10);
const logoMaxDots = Number.parseInt(
	process.env.PAYPARK_LOGO_MAX_DOTS || String(Math.floor(printerDots * 0.56)),
	10
);
const logoMaxHeight = Number.parseInt(process.env.PAYPARK_LOGO_MAX_HEIGHT || "92", 10);
const logoThreshold = Number.parseInt(process.env.PAYPARK_LOGO_THRESHOLD || "168", 10);

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

async function buildLogoRasterBytes(logoFilePath) {
	const input = readFileSync(logoFilePath);
	const meta = await sharp(input).metadata();
	if (!meta.width || !meta.height) {
		throw new Error("Could not read logo dimensions");
	}

	const targetWidth = Math.max(8, Math.min(printerDots, logoMaxDots, meta.width));
	const { data, info } = await sharp(input)
		.resize({
			width: targetWidth,
			height: logoMaxHeight,
			fit: "inside",
			withoutEnlargement: true,
			kernel: sharp.kernel.nearest,
		})
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	const targetHeight = info.height;
	const channels = info.channels;
	const widthBytes = Math.ceil(printerDots / 8);
	const rowData = Buffer.alloc(widthBytes * targetHeight, 0);
	const xOffset = Math.floor((printerDots - info.width) / 2);

	for (let y = 0; y < targetHeight; y += 1) {
		for (let x = 0; x < info.width; x += 1) {
			const idx = (y * info.width + x) * channels;
			const r = data[idx];
			const g = data[idx + 1];
			const b = data[idx + 2];
			const a = data[idx + 3] ?? 255;
			const alpha = a / 255;
			const luminance = (0.299 * r + 0.587 * g + 0.114 * b) * alpha + 255 * (1 - alpha);
			const isBlack = luminance < logoThreshold;

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

	// GS v 0 m xL xH yL yH d1..dk (raster bit image)
	return Buffer.concat([
		Buffer.from([0x1b, 0x61, 0x01]),
		Buffer.from([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]),
		rowData,
		Buffer.from([0x0a, 0x1b, 0x61, 0x00]),
	]);
}

async function buildEscPosReceipt() {
	const now = new Date();
	const divider = "-".repeat(receiptChars);
	const content = [
		center("PAYPARK"),
		center("Parking Receipt"),
		divider,
		line("Date", now.toLocaleDateString("en-CA")),
		line("Time", now.toLocaleTimeString("en-GB", { hour12: false })),
		line("Ticket", "TEST-0001"),
		line("Vehicle", "Car"),
		line("Amount", "PHP 50.00"),
		line("Status", "PAID"),
		divider,
		center("Thank you for parking!"),
		center("Drive safe."),
		"",
		"",
		"",
	].join("\n");

	// ESC/POS: Initialize + text + feed + cut.
	const init = Buffer.from([0x1b, 0x40]);
	const normal = Buffer.from([0x1b, 0x21, 0x00]);
	const text = Buffer.from(content, "ascii");
	const feed = Buffer.from([0x1b, 0x64, 0x03]);
	const cut = Buffer.from([0x1d, 0x56, 0x00]);

	let logo = Buffer.alloc(0);
	try {
		logo = await buildLogoRasterBytes(logoPath);
	} catch (error) {
		console.warn(`Logo skipped (${error.message})`);
	}

	return Buffer.concat([init, normal, logo, text, feed, cut]);
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

async function main() {
	const binPath = join(tmpdir(), "paypark-receipt-test.bin");
	const csPath = join(tmpdir(), "paypark-raw-printer-helper.cs");
	const txtPath = join(tmpdir(), "paypark-receipt-test.txt");

	writeFileSync(binPath, await buildEscPosReceipt());
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

	try {
		// Raw send to local printer prevents page scaling issues on thermal printers.
		const rawPs = [
			`Add-Type -Path '${csPath}'`,
			`$bytes = [System.IO.File]::ReadAllBytes('${binPath}')`,
			"$h = [IntPtr]::Zero",
			`$ok = [RawPrinterHelper]::OpenPrinter('${printerName}', [ref]$h, [IntPtr]::Zero)`,
			"if (-not $ok) { throw 'OpenPrinter failed for local printer name.' }",
			"$doc = New-Object RawPrinterHelper+DOCINFOA",
			"$doc.pDocName = 'Paypark ESCPOS Test'",
			"$doc.pDataType = 'RAW'",
			"$started = $false",
			"try {",
			"  $started = [RawPrinterHelper]::StartDocPrinter($h, 1, $doc)",
			"  if (-not $started) { throw 'StartDocPrinter failed.' }",
			"  if (-not [RawPrinterHelper]::StartPagePrinter($h)) { throw 'StartPagePrinter failed.' }",
			"  $written = 0",
			"  if (-not [RawPrinterHelper]::WritePrinter($h, $bytes, $bytes.Length, [ref]$written)) { throw 'WritePrinter failed.' }",
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

		console.log(rawOut || `Printed raw ESC/POS test receipt to ${printerName}`);
		return;
	} catch (rawErr) {
		console.warn(`Raw print failed (${rawErr.message}). Falling back to Out-Printer.`);
	}

	writeFileSync(
		txtPath,
		[
			"PAYPARK TEST RECEIPT",
			"------------------------------",
			`Date: ${new Date().toISOString().replace("T", " ").slice(0, 19)}`,
			"Vehicle: Car",
			"Amount: PHP 50.00",
			"Status: SUCCESS",
			"------------------------------",
			"Thank you!",
		].join("\n"),
		"ascii"
	);

	const ps = [
		`Get-Content '${txtPath}' | Out-Printer -Name '${printerName}'`,
		`Write-Host 'Printed fallback receipt to ${printerName} using ${txtPath}'`,
	].join("; ");

	const out = await run("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps]);
	if (out) {
		console.log(out);
	}
}

main().catch((error) => {
	console.error("Print test failed:", error.message);
	process.exitCode = 1;
});
