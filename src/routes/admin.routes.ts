import { Router, RequestHandler } from "express";
import container from "../di/container";
import { TYPES } from "../di/types";
import adminAuthMiddleware from "../middlewares/adminAuthMiddleware";
import { IAdminController } from "../controllers/interface/admin/interface";

const router = Router();
const adminController: IAdminController = container.get<IAdminController>(TYPES.IAdminController);

router.get("/users", adminAuthMiddleware, adminController.getUsers.bind(adminController) as RequestHandler);
router.get("/vehicles", adminAuthMiddleware, adminController.getVehicles.bind(adminController) as RequestHandler);

router.post("/login", adminController.adminLogin.bind(adminController) as RequestHandler);
router.post("/refresh", adminController.refreshToken.bind(adminController) as RequestHandler);
router.post("/logout", adminController.logout.bind(adminController) as RequestHandler); // Add logout route

router.patch("/users/:userId/status", adminAuthMiddleware, adminController.toggleUserStatus.bind(adminController) as RequestHandler);
router.patch("/vehicles/:vehicleId/status", adminAuthMiddleware, adminController.updateVehicleStatus.bind(adminController) as RequestHandler);

export default router;