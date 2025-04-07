import { injectable } from "inversify";
import TempUserModel from "../../models/tempUser.model";
import { ITempUserRepository } from "../interface/user/itempUserRepository";
import { ITempUser } from "../interface/user/itempUserRepository"

@injectable()
class TempUserRepository implements ITempUserRepository {
  async findTempUserByEmail(email: string): Promise<ITempUser | null> {
    try {
      const tempUser = await TempUserModel.findOne({ email });
      return tempUser;
    } catch (error) {
      throw new Error(`Failed to find temp user by email: ${(error as Error).message}`);
    }
  }

  async upsertTempUser(userData: ITempUser): Promise<ITempUser> {
    try {
      const tempUser = await TempUserModel.findOneAndUpdate(
        { email: userData.email },
        userData,
        { upsert: true, new: true }
      );
      if (!tempUser) {
        throw new Error("Failed to upsert temp user");
      }
      return tempUser;
    } catch (error) {
      throw new Error(`Failed to upsert temp user: ${(error as Error).message}`);
    }
  }

  async updateTempUserOTP(email: string, otp: string, otpExpiresAt: Date): Promise<ITempUser> {
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

  async deleteTempUser(email: string): Promise<void> {
    try {
      await TempUserModel.deleteOne({ email });
    } catch (error) {
      throw new Error(`Failed to delete temp user: ${(error as Error).message}`);
    }
  }
}

export default TempUserRepository;