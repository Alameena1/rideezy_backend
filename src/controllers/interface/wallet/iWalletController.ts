import { Request, Response } from "express";

export interface IWalletController {
  deposit(req: Request, res: Response): Promise<void> | void; // Allow void or no return
  getBalance(req: Request, res: Response): Promise<void> | void;
  withdraw(req: Request, res: Response): Promise<void> | void;
  getTransactions(req: Request, res: Response): Promise<void> | void;
  createDepositOrder(req: Request, res: Response): Promise<void> | void;
}