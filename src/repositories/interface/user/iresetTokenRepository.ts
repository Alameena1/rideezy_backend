export interface IResetTokenRepository {
  createToken(userId: string, token: string): Promise<any>;
  findToken(token: string): Promise<any>;
  findTokenByUserId(userId: string): Promise<any>;
  deleteToken(token: string): Promise<void>;
}