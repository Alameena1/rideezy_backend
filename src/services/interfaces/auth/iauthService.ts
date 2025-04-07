export interface IGoogleAuthUser {
  fullName: string;
  email: string;
  image?: string;
}

export interface IAuthService {
  signup(userData: any): Promise<{ success: boolean; message: string }>;
  resendOTP(email: string): Promise<{ success: boolean; message: string }>;
  verifyOTP(email: string, otp: string): Promise<{ success: boolean; message: string; user: any }>;
  login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }>;
  refreshToken(token: string): Promise<{ accessToken: string; refreshToken: string }>;
  logout(refreshToken: string): Promise<{ message: string }>;
  handleGoogleAuth(googleUser: IGoogleAuthUser): Promise<{ user: any; accessToken: string; refreshToken: string }>;
}