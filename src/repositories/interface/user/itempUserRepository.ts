export interface ITempUser {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  otp: string;
  otpExpiresAt: Date;
}

export interface ITempUserRepository {
  findTempUserByEmail(email: string): Promise<ITempUser | null>; 
  upsertTempUser(userData: ITempUser): Promise<ITempUser>
  updateTempUserOTP(email: string, otp: string, otpExpiresAt: Date): Promise<ITempUser>; 
  deleteTempUser(email: string): Promise<void>;
}