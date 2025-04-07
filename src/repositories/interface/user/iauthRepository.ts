import { IUser } from "../../../models/user.model";

export interface IAuthRepository {
  createUser(userData: Partial<IUser>): Promise<IUser>;
  findUserByEmail(email: string): Promise<IUser | null>;
}