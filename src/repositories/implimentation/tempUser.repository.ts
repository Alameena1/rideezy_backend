import { injectable } from "inversify";
import TempUserModel from "../../models/tempUser.model";
import { ITempUserRepository } from "../interface/user/itempUserRepository";
import { ITempUser, ITempUserInput } from "../interface/user/itempUserRepository";
import { BaseRepository } from "../base/base.repository";

@injectable()
export class TempUserRepository extends BaseRepository<ITempUser> implements ITempUserRepository {
  constructor() {
    super(TempUserModel);
  }

  async findTempUserByEmail(email: string): Promise<ITempUser | null> {
    console.log("Finding temp user by email:", email); 
    try {
      const tempUser = await this.model
        .findOne({ email })
        .select("+password")
        .lean() 
        .exec();
      console.log("Found temp user:", tempUser); 
      return tempUser;
    } catch (error) {
      console.error("Find error:", (error as Error).message); 
      throw new Error(`Failed to find temp user: ${(error as Error).message}`);
    }
  }

  async upsertTempUser(userData: ITempUserInput): Promise<ITempUser> {
    try {
      const otp = userData.otp || Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiresAt = userData.otpExpiresAt || new Date(Date.now() + 10 * 60 * 1000);
      const inputData = { ...userData, otp, otpExpiresAt };
      console.log("Upsert input data:", inputData); 

      const tempUser = await this.model.findOneAndUpdate(
        { email: userData.email },
        {
          fullName: userData.fullName,
          email: userData.email,
          phoneNumber: userData.phoneNumber || "",
          password: userData.password || "",
          otp,
          otpExpiresAt,
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
      console.log("Upsert raw update object:", {
        fullName: userData.fullName,
        email: userData.email,
        phoneNumber: userData.phoneNumber || "",
        password: userData.password || "",
        otp,
        otpExpiresAt,
      }); 
      console.log("Upsert result:", tempUser); 
      if (!tempUser) {
        throw new Error("Failed to upsert temp user");
      }
      return tempUser;
    } catch (error) {
      console.error("Upsert error:", (error as Error).message); 
      throw new Error(`Failed to upsert temp user: ${(error as Error).message}`);
    }
  }

  async updateTempUserOTP(email: string, otp: string, otpExpiresAt: Date): Promise<ITempUser> {
    try {
      const tempUser = await this.model.findOneAndUpdate(
        { email },
        { otp, otpExpiresAt },
        { new: true, runValidators: true }
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
      await this.model.deleteOne({ email });
    } catch (error) {
      throw new Error(`Failed to delete temp user: ${(error as Error).message}`);
    }
  }
}

export default TempUserRepository;