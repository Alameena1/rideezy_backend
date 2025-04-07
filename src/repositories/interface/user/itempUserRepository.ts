interface ITempUser {
    fullName: string;
    email: string;
    phoneNumber: string;
    password: string;
    otp: string;
    otpExpiresAt: Date;
  }
  
  export interface ITempUserRepository {
    findTempUserByEmail(email: string): Promise<any>;
    upsertTempUser(userData: ITempUser): Promise<any>;
    updateTempUserOTP(email: string, otp: string, otpExpiresAt: Date): Promise<any>;
    deleteTempUser(email: string): Promise<void>;
  }