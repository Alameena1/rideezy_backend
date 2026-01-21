import { injectable } from "inversify";
import { IResetTokenRepository } from "../interface/user/iresetTokenRepository";
import ResetTokenModel from "../../models/resetToken.model";

@injectable()
export class ResetTokenRepository implements IResetTokenRepository {
  async createToken(userId: string, token: string): Promise<any> {
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour expiry
    const resetToken = new ResetTokenModel({ userId, token, expiresAt });
    return await resetToken.save();
  }

  async findToken(token: string): Promise<any> {
    return await ResetTokenModel.findOne({ token }).exec();
  }

  async findTokenByUserId(userId: string): Promise<any> {
    return await ResetTokenModel.findOne({ userId }).exec();
  }

  async deleteToken(token: string): Promise<void> {
    await ResetTokenModel.deleteOne({ token }).exec();
  }
}