import { IUser } from "../../../models/user.model";

export interface IWalletService {
  getBalance(userId: string): Promise<number>;
  createDepositOrder(userId: string, amount: number): Promise<any>;
  deposit(
    userId: string,
    amount: number,
    paymentId: string,
    orderId: string,
    signature: string
  ): Promise<IUser>;
  withdraw(userId: string, amount: number): Promise<IUser>;
  getTransactions(
    userId: string,
    page?: number,
    limit?: number
  ): Promise<{
    transactions: any[];
    total: number;
    totalPages: number;
    currentPage: number;
    balance: number;
  }>;
  getWallet(userId: string): Promise<{ balance: number; transactions: any[] }>;
}