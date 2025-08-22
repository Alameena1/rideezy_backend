import { Request, Response } from "express";
import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { IWalletService } from "../../services/interfaces/wallet/iWalletService";
import { IWalletController } from "../interface/wallet/iWalletController";

@injectable()
export class WalletController implements IWalletController {
  private walletService: IWalletService;

  constructor(
    @inject(TYPES.IWalletService) walletService: IWalletService
  ) {
    this.walletService = walletService;
  }

  async getBalance(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      if (!userId) {
        res.status(400).json({ success: false, message: "userId is required" });
        return;
      }
      const wallet = await this.walletService.getWallet(userId);
      res.status(200).json({ success: true, ...wallet });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  async deposit(req: Request, res: Response): Promise<void> {
    try {
      const { userId, amount, paymentId, orderId, signature } = req.body;
      if (!userId || !amount || !paymentId || !orderId || !signature) {
        res.status(400).json({ success: false, message: "All fields are required" });
        return;
      }
      const user = await this.walletService.deposit(userId, amount, paymentId, orderId, signature);
      res.status(200).json({ success: true, user });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  async withdraw(req: Request, res: Response): Promise<void> {
    try {
      const { userId, amount } = req.body;
      if (!userId || !amount) {
        res.status(400).json({ success: false, message: "User ID and amount are required" });
        return;
      }
      const user = await this.walletService.withdraw(userId, amount);
      res.status(200).json({ success: true, message: "Withdrawal successful", user });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!userId) {
        res.status(400).json({ success: false, message: "User ID is required" });
        return;
      }

      const result = await this.walletService.getTransactions(userId, page, limit);
      res.status(200).json({
        success: true,
        transactions: result.transactions,
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        balance: result.balance, // Include balance in the response
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async createDepositOrder(req: Request, res: Response): Promise<void> {
    try {
      const { userId, amount } = req.body;
      if (!userId || !amount) {
        res.status(400).json({ success: false, message: "User ID and amount are required" });
        return;
      }
      const order = await this.walletService.createDepositOrder(userId, amount);
      res.status(200).json({ success: true, order });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}