import { IAdminRepository } from "../interface/admin/interface";
import UserModel from "../../models/user.model";
import { injectable } from "inversify";

@injectable()
export class AdminRepository implements IAdminRepository {
  private adminEmail: string;
  private adminPassword: string;

  constructor() {
    this.adminEmail = process.env.ADMIN_EMAIL as string;
    this.adminPassword = process.env.ADMIN_PASSWORD as string;
  }

  public getAdminCredentials() {
    return {
      email: this.adminEmail,
      password: this.adminPassword,
    };
  }

  public async getAllUsers(): Promise<any[]> {
    try {
      const users = await UserModel.find().select("-password");
      console.log("usersdsds", users);
      return users;
    } catch (error) {
      throw new Error("Failed to fetch users from the database");
    }
  }

  public async updateUserStatus(userId: string, status: "Active" | "Blocked"): Promise<void> {
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }
      user.status = status;
      await user.save();
    } catch (error) {
      throw new Error("Failed to update user status");
    }
  }
}