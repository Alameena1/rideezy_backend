import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { IWalletService } from "../interfaces/wallet/iWalletService";
import { IWalletRepository, UserUpdate } from "../../repositories/interface/wallet/iWalletRepository";
import Razorpay from "razorpay";
import { createHmac } from "crypto";
import { v4 as uuidv4 } from "uuid";
import UserModel, { IUser } from "../../models/user.model";

@injectable()
export class WalletService implements IWalletService {
  private walletRepository: IWalletRepository;
  private razorpay: Razorpay;

  constructor(
    @inject(TYPES.IWalletRepository) walletRepository: IWalletRepository
  ) {
    this.walletRepository = walletRepository;
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_KOCURsj88Mu4Sj",
      key_secret: process.env.RAZORPAY_KEY_SECRET || "64CY4QIGucP0t33gP8JodsqI",
    });
  }

  async getBalance(userId: string): Promise<number> {
    const user = await this.walletRepository.findUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    return user.wallet.balance;
  }

  async createDepositOrder(userId: string, amount: number): Promise<any> {
    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: `rcpt_${userId.slice(0, 15)}_${Date.now().toString().slice(-6)}`,
    };

    try {
      const order = await this.razorpay.orders.create(options);
      return {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      };
    } catch (error) {
      console.error("Razorpay order creation failed:", error);
      throw error;
    }
  }

  async deposit(userId: string, amount: number, paymentId: string, orderId: string, signature: string): Promise<IUser> {
    const generatedSignature = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "64CY4QIGucP0t33gP8JodsqI")
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (generatedSignature !== signature) {
      throw new Error("Invalid payment signature");
    }

    const transactionId = uuidv4();
    return await this.walletRepository.updateUser(userId, {
      $inc: { "wallet.balance": amount },
      $push: {
        "wallet.transactions": {
          transactionId,
          type: "DEPOSIT",
          amount,
          status: "COMPLETED",
          createdAt: new Date(),
        },
      },
    } as UserUpdate);
  }

  async withdraw(userId: string, amount: number): Promise<IUser> {
    const user = await this.walletRepository.findUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.wallet.balance < amount) {
      throw new Error("Insufficient balance");
    }

    const transactionId = uuidv4();
    return await this.walletRepository.updateUser(userId, {
      $inc: { "wallet.balance": -amount },
      $push: {
        "wallet.transactions": {
          transactionId,
          type: "WITHDRAWAL",
          amount,
          status: "COMPLETED",
          createdAt: new Date(),
        },
      },
    } as UserUpdate);
  }

  async getTransactions(userId: string, page: number = 1, limit: number = 10): Promise<{
    transactions: any[];
    total: number;
    totalPages: number;
    currentPage: number;
    balance: number;
  }> {
    const user = await this.walletRepository.findUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }
console.log("user.wallet.balance",user.wallet.balance)
    const transactions = user.wallet.transactions || [];
    const total = transactions.length;

    // Calculate skip and limit for pagination
    const skip = (page - 1) * limit;
    const paginatedTransactions = transactions
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) 
      .slice(skip, skip + limit);

    return {
      transactions: paginatedTransactions,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      balance: user.wallet.balance,
    };
  }

  async getWallet(userId: string): Promise<{ balance: number; transactions: any[] }> {
    const user = await this.walletRepository.findUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    return {
      balance: user.wallet.balance,
      transactions: user.wallet.transactions || [],
    };
  }
}