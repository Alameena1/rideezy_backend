import { ClientSession, FilterQuery, UpdateQuery } from "mongoose";
import { IUser } from "../../../models/user.model";

export interface IUserRepository {
  findUserById(userId: string, options?: { session: ClientSession }): Promise<IUser | null>;
  updateUserProfile(userId: string, updatedData: Partial<IUser>, options?: { session: ClientSession }): Promise<IUser | null>;
  updateOne(query: FilterQuery<IUser>, update: UpdateQuery<IUser>, options?: { session: ClientSession }): Promise<IUser | null>;
  startSession(): Promise<ClientSession>;
}