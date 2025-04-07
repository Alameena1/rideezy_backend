import UserModel, { IUser } from "../../models/user.model";
import { IAuthRepository } from "../interface/user/iauthRepository";

class AuthRepository implements IAuthRepository {
  async createUser(userData: Partial<IUser>): Promise<IUser> {
    try {
      const user = await UserModel.create(userData);
      return user;
    } catch (error) {
      throw new Error(`Failed to create user: ${(error as Error).message}`);
    }
  }

  async findUserByEmail(email: string): Promise<IUser | null> {
    try {
      const user = await UserModel.findOne({ email });
      return user;
    } catch (error) {
      throw new Error(`Failed to find user by email: ${(error as Error).message}`);
    }
  }
}

export default new AuthRepository();