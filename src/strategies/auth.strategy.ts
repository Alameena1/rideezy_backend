export interface AuthStrategy {
    signup(userData: any): Promise<any>;
  }
  