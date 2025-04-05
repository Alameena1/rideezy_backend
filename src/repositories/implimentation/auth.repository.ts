import UserModel from "../../models/user.model";

interface IUser {
  fullName: string;
  email: string;
  password?: string;
  phoneNumber?: string;
}

class UserRepository {
  static async createUser(userData: IUser) {
    return await UserModel.create(userData);
  }

  static async findUserByEmail(email: string) {
    return await UserModel.findOne({ email });
  }

  static async findUserById(userId: string) {
    return await UserModel.findById(userId);
  }

  static async updateUser(userId: string, updatedData: Partial<IUser>) {
    return await UserModel.findByIdAndUpdate(userId, updatedData, { new: true });
  }

  static async updateUserProfile(userId: string, updatedData: Partial<IUser>) {
    return await UserModel.findByIdAndUpdate(userId, updatedData, { new: true });
  }
}

export default UserRepository;