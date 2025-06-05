import { injectable } from "inversify";
import UserModel, { IUser } from "../../models/user.model";
import { IUserRepository } from "../interface/user/iuserRepository";
import { BaseRepository } from "../base/base.repository";

@injectable()
export class UserRepository extends BaseRepository<IUser> implements IUserRepository {
  constructor() {
    super(UserModel);
  }

  async findUserById(userId: string): Promise<IUser | null> {
    return this.findById(userId);
  }

  async updateUserProfile(userId: string, updatedData: Partial<IUser>): Promise<IUser | null> {
    return this.updateById(userId, updatedData);
  }
}

export default UserRepository;