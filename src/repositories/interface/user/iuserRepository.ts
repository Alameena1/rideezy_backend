interface IUser {
    fullName: string;
    email: string;
    password?: string;
    phoneNumber?: string;
    image?: string;
  }
  
  export interface IUserRepository {
    findUserById(userId: string): Promise<any>;
    updateUserProfile(userId: string, updatedData: Partial<IUser>): Promise<any>;
  }