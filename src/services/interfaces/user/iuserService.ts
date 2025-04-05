import { IUser } from "./IUser";

export interface IAuthService {
  signup(userData: IUser): Promise<{ success: boolean; message: string }>;
  verifyOTP(email: string, otp: string): Promise<{ success: boolean; message: string; user?: any }>;
  login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string } | null>;
  refreshToken(token: string): Promise<{ accessToken: string; refreshToken: string }>;
  logout(refreshToken: string): Promise<{ message: string }>;
  handleGoogleAuth(googleUser: IUser): Promise<{ user: any; accessToken: string; refreshToken: string }>;
  getProfile(userId: string): Promise<any>;
  updateProfile(userId: string, updatedData: any): Promise<any>;
}