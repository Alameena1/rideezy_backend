import TempUserModel from "../../models/tempUser.model";
import { ITempUserRepository } from "../interface/user/itempUserRepository";

interface ITempUser {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  otp: string;
  otpExpiresAt: Date;
}

class TempUserRepository implements ITempUserRepository {
  async findTempUserByEmail(email: string) {
    try {
      const tempUser = await TempUserModel.findOne({ email });
      return tempUser;
    } catch (error) {
      throw new Error(`Failed to find temp user by email: ${(error as Error).message}`);
    }
  }

  async upsertTempUser(userData: ITempUser) {
    try {
      const tempUser = await TempUserModel.findOneAndUpdate(
        { email: userData.email },
        userData,
        { upsert: true, new: true }
      );
      return tempUser;
    } catch (error) {
      throw new Error(`Failed to upsert temp user: ${(error as Error).message}`);
    }
  }

  async updateTempUserOTP(email: string, otp: string, otpExpiresAt: Date) {
    try {
      const tempUser = await TempUserModel.findOneAndUpdate(
        { email },
        { otp, otpExpiresAt },
        { new: true }
      );
      if (!tempUser) {
        throw new Error("Temp user not found");
      }
      return tempUser;
    } catch (error) {
      throw new Error(`Failed to update temp user OTP: ${(error as Error).message}`);
    }
  }

  async deleteTempUser(email: string) {
    try {
      await TempUserModel.deleteOne({ email });
    } catch (error) {
      throw new Error(`Failed to delete temp user: ${(error as Error).message}`);
    }
  }
}

export default new TempUserRepository();