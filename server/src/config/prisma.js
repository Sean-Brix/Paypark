import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const rawConnectionString =
	process.env.DATABASE_URL || "mysql://root:password@localhost:3306/paypark";

if (!process.env.DATABASE_URL) {
	console.warn(
		"DATABASE_URL not set. Using default local MySQL connection string."
	);
}

function normalizeMariaDbUrl(urlValue) {
	let normalized = String(urlValue || "").trim();

	if (normalized.startsWith("mysql://")) {
		normalized = `mariadb://${normalized.slice("mysql://".length)}`;
	}

	try {
		const parsed = new URL(normalized);
		const sslMode = parsed.searchParams.get("ssl-mode");

		if (sslMode && sslMode.toUpperCase() === "REQUIRED") {
			parsed.searchParams.set("ssl", "true");
			parsed.searchParams.delete("ssl-mode");
		}

		return parsed.toString();
	} catch {
		return normalized;
	}
}

const connectionString = normalizeMariaDbUrl(rawConnectionString);

if (rawConnectionString !== connectionString) {
	console.log("Normalized DATABASE_URL for MariaDB driver compatibility.");
}

function toBoolean(value, fallback) {
	if (value === undefined || value === null || value === "") {
		return fallback;
	}

	const normalized = String(value).trim().toLowerCase();
	if (["1", "true", "yes", "on"].includes(normalized)) {
		return true;
	}

	if (["0", "false", "no", "off"].includes(normalized)) {
		return false;
	}

	return fallback;
}

function buildMariaDbAdapterConfig(urlValue) {
	const parsed = new URL(urlValue);
	const sslMode = String(parsed.searchParams.get("ssl-mode") || "").toUpperCase();
	const sslEnabled = toBoolean(parsed.searchParams.get("ssl"), sslMode === "REQUIRED");
	const rejectUnauthorized = toBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false);

	const config = {
		host: parsed.hostname,
		port: Number(parsed.port || 3306),
		user: decodeURIComponent(parsed.username),
		password: decodeURIComponent(parsed.password),
		database: parsed.pathname.replace(/^\//, ""),
	};

	if (sslEnabled) {
		config.ssl = { rejectUnauthorized };
	}

	return config;
}

const adapter = new PrismaMariaDb(buildMariaDbAdapterConfig(connectionString));

export const prisma = new PrismaClient({ adapter });
