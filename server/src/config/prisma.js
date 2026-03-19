import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const connectionString =
	process.env.DATABASE_URL || "mysql://root:password@localhost:3306/paypark";

if (!process.env.DATABASE_URL) {
	console.warn(
		"DATABASE_URL not set. Using default local MySQL connection string."
	);
}

const adapter = new PrismaMariaDb(connectionString);

export const prisma = new PrismaClient({ adapter });
