import { IUser } from "../../../models/user.model";

export interface IUserService {
  getProfile(userId: string): Promise<IUser>;
  updateProfile(userId: string, updatedData: any): Promise<IUser>;
}