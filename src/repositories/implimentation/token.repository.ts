// repositories/implementation/token.repository.ts
import { injectable } from "inversify";
import TokenModel from "../../models/token.model";
import { ITokenRepository } from "../interface/user/itokenRepository";
import { BaseRepository } from "../base/base.repository";

@injectable()
export class TokenRepository extends BaseRepository<any> implements ITokenRepository {
  constructor() {
    super(TokenModel);
  }

  async findToken(refreshToken: string) {
    return this.findOne({ refreshToken });
  }

  async replaceToken(userId: string, refreshToken: string) {
    return this.model.findOneAndUpdate(
      { userId },
      { refreshToken, updatedAt: new Date() },
      { upsert: true, new: true }
    );
  }

  async deleteToken(refreshToken: string) {
    try {
      await this.model.deleteOne({ refreshToken });
    } catch (error) {
      throw new Error(`Failed to delete token: ${(error as Error).message}`);
    }
  }
}

export default TokenRepository;