// src/routes/admin.routes.ts
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
router.post("/logout", adminController.logout.bind(adminController) as RequestHandler);

router.patch("/users/:userId/status", adminAuthMiddleware, adminController.updateUserStatus.bind(adminController) as RequestHandler);
router.patch("/vehicles/:vehicleId/status", adminAuthMiddleware, adminController.updateVehicleStatus.bind(adminController) as RequestHandler);

router.post("/verify-gov-id", adminAuthMiddleware, adminController.verifyGovId.bind(adminController) as RequestHandler);

router.post("/subscriptions", adminAuthMiddleware, adminController.createSubscriptionPlan.bind(adminController) as RequestHandler);
router.get("/subscriptions", adminAuthMiddleware, adminController.getSubscriptionPlans.bind(adminController) as RequestHandler);
router.patch("/subscriptions/:planId", adminAuthMiddleware, adminController.updateSubscriptionPlan.bind(adminController) as RequestHandler);
router.delete("/subscriptions/:planId", adminAuthMiddleware, adminController.deleteSubscriptionPlan.bind(adminController) as RequestHandler);
router.patch("/subscriptions/:planId/status", adminAuthMiddleware, adminController.updateSubscriptionPlanStatus.bind(adminController) as RequestHandler);

export default router;