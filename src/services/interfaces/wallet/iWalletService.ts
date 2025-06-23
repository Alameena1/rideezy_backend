export interface IWalletService {
  getBalance(userId: string): Promise<number>;
  deposit(userId: string, amount: number, paymentId: string, orderId: string, signature: string): Promise<any>;
  withdraw(userId: string, amount: number): Promise<any>;
  getTransactions(userId: string): Promise<any[]>;
  createDepositOrder(userId: string, amount: number): Promise<any>;
  getWallet(userId: string): Promise<{ balance: number; transactions: any[] }>; 
}