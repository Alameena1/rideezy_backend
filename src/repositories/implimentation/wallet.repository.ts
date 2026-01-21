import { injectable } from "inversify";
import { IWalletRepository, UserUpdate } from "../interface/wallet/iWalletRepository";
import UserModel, { IUser } from "../../models/user.model";

@injectable()
export class WalletRepository implements IWalletRepository {
  async findUserById(userId: string): Promise<IUser | null> {
    return await UserModel.findById(userId).exec();
  }

  async updateUser(userId: string, userData: UserUpdate): Promise<IUser> {
    const user = await UserModel.findByIdAndUpdate(userId, userData, { new: true }).exec();
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  async createDepositOrder(userId: string, amount: number): Promise<any> {
    // This is typically handled in WalletService with Razorpay
    throw new Error("Method not implemented in repository; use WalletService");
  }
}