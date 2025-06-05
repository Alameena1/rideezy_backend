import { IUser } from '../../../models/user.model';

export interface IUserRepository {
  findUserById(userId: string): Promise<IUser | null>;
  updateUserProfile(userId: string, updatedData: Partial<IUser>): Promise<IUser | null>;
}