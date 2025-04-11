import { injectable } from "inversify";
import UserModel, { IUser } from "../../models/user.model";
import { IAuthRepository } from "../interface/user/iauthRepository";
import { BaseRepository } from "../base/base.repository";

@injectable()
export class AuthRepository extends BaseRepository<IUser> implements IAuthRepository {
  constructor() {
    super(UserModel);
  }

  async createUser(userData: Partial<IUser>): Promise<IUser> {
    return this.create(userData);
  }

  async findUserByEmail(email: string): Promise<IUser | null> {
    try {
      const user = await this.model
        .findOne({ email })
        .select("+password") 
        .lean()
        .exec();
      return user;
    } catch (error) {
      console.error("Find user error:", (error as Error).message);
      throw new Error(`Failed to find user: ${(error as Error).message}`);
    }
  }
}

export default AuthRepository;