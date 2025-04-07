import UserModel, { IUser } from "../../models/user.model";
import { IUserRepository } from "../interface/user/iuserRepository";

class UserRepository implements IUserRepository {
  async findUserById(userId: string): Promise<IUser | null> {
    try {
      const user = await UserModel.findById(userId).select("-password");
      return user;
    } catch (error) {
      throw new Error(`Failed to find user by ID: ${(error as Error).message}`);
    }
  }

  async updateUserProfile(userId: string, updatedData: Partial<IUser>): Promise<IUser | null> {
    try {
      const user = await UserModel.findByIdAndUpdate(userId, updatedData, { new: true });
      return user;
    } catch (error) {
      throw new Error(`Failed to update user profile: ${(error as Error).message}`);
    }
  }
}

export default new UserRepository();