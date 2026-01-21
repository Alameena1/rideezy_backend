import { injectable } from "inversify";
import { ClientSession, FilterQuery, UpdateQuery } from "mongoose";
import { IUserRepository } from "../interface/user/iuserRepository";
import { IUser } from "../../models/user.model";
import  UserModel  from "../../models/user.model";
import { BaseRepository } from "../base/base.repository";

@injectable()
export class UserRepository extends BaseRepository<IUser> implements IUserRepository {
  constructor() {
    super(UserModel);
  }

  async findUserById(userId: string, options?: { session: ClientSession }): Promise<IUser | null> {
    return this.findById(userId, options);
  }

  async updateUserProfile(
    userId: string,
    updatedData: Partial<IUser>,
    options?: { session: ClientSession }
  ): Promise<IUser | null> {
    return this.updateById(userId, updatedData, options);
  }

  async updateOne(
    query: FilterQuery<IUser>,
    update: UpdateQuery<IUser>,
    options?: { session: ClientSession }
  ): Promise<IUser | null> {
    try {
      const document = await this.model
        .findOneAndUpdate(query, update, { new: true, runValidators: true, session: options?.session ?? null })
        .lean()
        .exec();
      return document as IUser | null;
    } catch (error) {
      console.error(`[UserRepository] Error updating user with query ${JSON.stringify(query)}: ${(error as Error).message}`);
      throw new Error(`Failed to update user: ${(error as Error).message}`);
    }
  }

  async startSession(): Promise<ClientSession> {
    return this.model.startSession();
  }
}