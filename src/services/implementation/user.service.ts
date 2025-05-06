import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { IUserRepository } from "../../repositories/interface/user/iuserRepository";
import { IUserService } from "../interfaces/user/iuserService";
import { IUser } from "../../models/user.model";

@injectable()
export default class UserService implements IUserService {
  private userRepository: IUserRepository;

  constructor(@inject(TYPES.IUserRepository) userRepository: IUserRepository) {
    this.userRepository = userRepository;
  }

  async getProfile(userId: string): Promise<IUser> {
    const user = await this.userRepository.findUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  async updateProfile(userId: string, updatedData: any): Promise<IUser> {
    if (!userId) {
      throw new Error("User ID is required.");
    }
    // If govId is being updated, ensure verificationStatus is set to "Pending"
    if (updatedData.govId) {
      updatedData.govId.verificationStatus = "Pending";
    }
    const updatedUser = await this.userRepository.updateUserProfile(userId, updatedData);
    if (!updatedUser) {
      throw new Error("Failed to update profile.");
    }
    return updatedUser;
  }

  async isGovIdVerified(userId: string): Promise<boolean> {
    const user = await this.userRepository.findUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    return user.govId?.verificationStatus === "Verified";
  }
}