export interface ISubscriptionService {
  getAllPlans(): Promise<any[]>;
  subscribeUser(userId: string, planId: string): Promise<any>;
 isSubscribed(userId: string): Promise<{ isSubscribed: boolean; subscription?: any }>; 
  canRegisterVehicle(userId: string): Promise<boolean>;
  canBookRide(userId: string): Promise<boolean>; 
  createPaymentOrder(planId: string): Promise<any>;
  verifyAndSubscribe(userId: string, planId: string, paymentId: string, orderId: string, signature: string): Promise<any>;
}