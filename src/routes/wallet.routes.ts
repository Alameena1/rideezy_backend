import { Router } from "express";
import container from "../di/container";
import { TYPES } from "../di/types";
import { IWalletController } from "../controllers/interface/wallet/iWalletController";
import authMiddleware from "../middlewares/auth.middleware";

const router = Router();
const walletController = container.get<IWalletController>(TYPES.IWalletController);

router.get("/balance/:userId", authMiddleware, (req, res) => walletController.getBalance(req, res));
router.post("/deposit", authMiddleware, (req, res) => walletController.deposit(req, res));
router.post("/withdraw", authMiddleware, (req, res) => walletController.withdraw(req, res));
router.get("/transactions/:userId", authMiddleware, (req, res) => walletController.getTransactions(req, res));
router.post("/create-deposit-order", authMiddleware, (req, res) => walletController.createDepositOrder(req, res));
export default router;