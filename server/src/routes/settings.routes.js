import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/settings.controller.js";
import { asyncHandler } from "../utils/api.js";
import { validateSettingsPatch } from "../middleware/validators.js";

export const settingsRouter = Router();

settingsRouter.get("/", asyncHandler(getSettings));
settingsRouter.patch("/", validateSettingsPatch, asyncHandler(updateSettings));
