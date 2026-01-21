import { IUser } from "../../../models/user.model";

export interface UserUpdate {
  $inc?: { [key: string]: number };
  $push?: { [key: string]: any };
  $set?: Partial<IUser>;
}

export interface IWalletRepository {
  findUserById(userId: string): Promise<IUser | null>;
  updateUser(userId: string, userData: UserUpdate): Promise<IUser>;
  createDepositOrder(userId: string, amount: number): Promise<any>;
}