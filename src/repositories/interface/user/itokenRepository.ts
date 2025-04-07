export interface ITokenRepository {
    findToken(refreshToken: string): Promise<any>;
    replaceToken(userId: string, refreshToken: string): Promise<any>;
    deleteToken(refreshToken: string): Promise<void>;
  }