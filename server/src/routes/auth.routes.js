import { Router } from "express";
import { changePassword, login } from "../controllers/auth.controller.js";
import { validateChangePassword, validateLogin } from "../middleware/validators.js";
import { asyncHandler } from "../utils/api.js";

export const authRouter = Router();

authRouter.post("/login", validateLogin, asyncHandler(login));
authRouter.patch("/password", validateChangePassword, asyncHandler(changePassword));
