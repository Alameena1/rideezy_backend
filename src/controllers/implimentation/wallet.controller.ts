import { Request, Response } from "express";
import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { IWalletService } from "../../services/interfaces/wallet/iWalletService";
import { IWalletController } from "../interface/wallet/iWalletController";
import { StatusCode } from "../../constants/status-codes.enum";
import { ResponseMessages } from "../../constants/response-messages.const";

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
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }
      const wallet = await this.walletService.getWallet(userId);
      res.status(StatusCode.OK).json({ success: true, ...wallet });
    } catch (error) {
      console.error("[WalletController] Error fetching wallet balance:", error);
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: (error as Error).message });
    }
  }

  async deposit(req: Request, res: Response): Promise<void> {
    try {
      const { userId, amount, paymentId, orderId, signature } = req.body;
      if (!userId || !amount || !paymentId || !orderId || !signature) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }
      const user = await this.walletService.deposit(userId, amount, paymentId, orderId, signature);
      res.status(StatusCode.OK).json({ success: true, user });
    } catch (error) {
      console.error("[WalletController] Error processing deposit:", error);
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: (error as Error).message });
    }
  }

  async withdraw(req: Request, res: Response): Promise<void> {
    try {
      const { userId, amount } = req.body;
      if (!userId || !amount) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }
      const user = await this.walletService.withdraw(userId, amount);
      res.status(StatusCode.OK).json({ success: true, message: "Withdrawal successful", user });
    } catch (error: any) {
      console.error("[WalletController] Error processing withdrawal:", error);
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }

  async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!userId) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }

      const result = await this.walletService.getTransactions(userId, page, limit);
      res.status(StatusCode.OK).json({
        success: true,
        transactions: result.transactions,
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        balance: result.balance,
      });
    } catch (error: any) {
      console.error("[WalletController] Error fetching transactions:", error);
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
    }
  }

  async createDepositOrder(req: Request, res: Response): Promise<void> {
    try {
      const { userId, amount } = req.body;
      if (!userId || !amount) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }
      const order = await this.walletService.createDepositOrder(userId, amount);
      res.status(StatusCode.OK).json({ success: true, order });
    } catch (error: any) {
      console.error("[WalletController] Error creating deposit order:", error);
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }
}