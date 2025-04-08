// repositories/implementation/admin.repository.ts
import { injectable } from "inversify";
import UserModel from "../../models/user.model";
import { IAdminRepository } from "../interface/admin/interface";
import { BaseRepository } from "../base/base.repository";

@injectable()
export class AdminRepository extends BaseRepository<any> implements IAdminRepository {
  private adminEmail: string;
  private adminPassword: string;

  constructor() {
    super(UserModel); // Using UserModel for user-related operations
    this.adminEmail = process.env.ADMIN_EMAIL as string;
    this.adminPassword = process.env.ADMIN_PASSWORD as string;
  }

  public getAdminCredentials(): { email: string; password: string } {
    return {
      email: this.adminEmail,
      password: this.adminPassword,
    };
  }

  public async getAllUsers(): Promise<any[]> {
    try {
      const users = await this.model.find().select("-password");
      console.log("usersdsds", users);
      return users;
    } catch (error) {
      throw new Error("Failed to fetch users from the database");
    }
  }

  public async updateUserStatus(userId: string, status: "Active" | "Blocked"): Promise<void> {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }
      await this.updateById(userId, { status } as any); // Type assertion due to partial update
    } catch (error) {
      throw new Error("Failed to update user status");
    }
  }
}

export default AdminRepository;