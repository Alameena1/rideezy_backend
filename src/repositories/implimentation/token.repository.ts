import { injectable } from "inversify";
import TokenModel from "../../models/token.model";
import { ITokenRepository } from "../interface/user/itokenRepository";

@injectable()
class TokenRepository implements ITokenRepository {
  async findToken(refreshToken: string) {
    try {
      const token = await TokenModel.findOne({ refreshToken });
      return token;
    } catch (error) {
      throw new Error(`Failed to find token: ${(error as Error).message}`);
    }
  }

  async replaceToken(userId: string, refreshToken: string) {
    try {
      const token = await TokenModel.findOneAndUpdate(
        { userId },
        { refreshToken, updatedAt: new Date() },
        { upsert: true, new: true }
      );
      return token;
    } catch (error) {
      throw new Error(`Failed to replace token: ${(error as Error).message}`);
    }
  }

  async deleteToken(refreshToken: string) {
    try {
      await TokenModel.deleteOne({ refreshToken });
    } catch (error) {
      throw new Error(`Failed to delete token: ${(error as Error).message}`);
    }
  }
}

export default TokenRepository; 