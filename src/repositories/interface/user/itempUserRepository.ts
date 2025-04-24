// repositories/interface/user/itempUserRepository.ts
import { Document } from "mongoose";

export interface ITempUserInput {
  fullName: string;
  email: string;
  phoneNumber?: string;
  password?: string;
  otp?: string;
  otpExpiresAt?: Date;
}

export interface ITempUser extends Document {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  otp: string;
  otpExpiresAt: Date;
}

export interface ITempUserRepository {
  findTempUserByEmail(email: string): Promise<ITempUser | null>;
  upsertTempUser(userData: ITempUserInput): Promise<ITempUser>; // Changed from ITempUser to ITempUserInput
  updateTempUserOTP(email: string, otp: string, otpExpiresAt: Date): Promise<ITempUser>;
  deleteTempUser(email: string): Promise<void>;
}