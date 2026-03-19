import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { sendSuccess, toHttpError } from "../utils/api.js";

function toSafeAdminPayload(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    initials: row.initials,
    createdAt: row.createdAt,
    lastLogin: row.lastLogin,
  };
}

export async function login(req, res) {
  const username = req.body.username.trim();
  const password = req.body.password;

  const admin = await prisma.admin.findUnique({
    where: { username },
  });

  if (!admin) {
    throw toHttpError("Invalid username or password", 401);
  }

  const isHash = /^\$2[aby]\$\d{2}\$/.test(admin.passwordHash);
  const passwordMatches = isHash
    ? await bcrypt.compare(password, admin.passwordHash)
    : password === admin.passwordHash;

  if (!passwordMatches) {
    throw toHttpError("Invalid username or password", 401);
  }

  const updated = await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLogin: new Date() },
  });

  return sendSuccess(res, toSafeAdminPayload(updated), "Login successful");
}
