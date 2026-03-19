import { Router } from "express";
import { login } from "../controllers/auth.controller.js";
import { validateLogin } from "../middleware/validators.js";
import { asyncHandler } from "../utils/api.js";

export const authRouter = Router();

authRouter.post("/login", validateLogin, asyncHandler(login));
