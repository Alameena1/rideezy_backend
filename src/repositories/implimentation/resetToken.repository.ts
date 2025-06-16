import { injectable } from "inversify";
import ResetTokenModel from "../../models/resetToken.model";
import { BaseRepository } from "../base/base.repository";

@injectable()
export class ResetTokenRepository extends BaseRepository<any> {
  constructor() {
    super(ResetTokenModel);
  }

  async createToken(userId: string, token: string) {
    return this.model.create({ userId, token });
  }

  async findToken(token: string) {
    return this.findOne({ token });
  }

  async deleteToken(token: string) {
    await this.model.deleteOne({ token });
  }
  async findTokenByUserId(userId: string) {
  return await ResetTokenModel.findOne({ userId });
}
}

export default ResetTokenRepository;