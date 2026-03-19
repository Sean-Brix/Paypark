import { Router } from "express";
import { listVehicles, updateVehicle } from "../controllers/vehicles.controller.js";
import { asyncHandler } from "../utils/api.js";
import { validateVehiclePatch } from "../middleware/validators.js";

export const vehiclesRouter = Router();

vehiclesRouter.get("/", asyncHandler(listVehicles));
vehiclesRouter.patch("/:id", validateVehiclePatch, asyncHandler(updateVehicle));
