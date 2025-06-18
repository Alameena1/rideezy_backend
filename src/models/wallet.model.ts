import { Schema, model, Document } from 'mongoose';

export interface ITransaction extends Document {
  id: string;
  amount: number;
  type: string; // "Credit" or "Debit"
  date: Date;
}

export interface IWallet extends Document {
  userId: string;
  balance: number;
  currency: string;
  transactions: ITransaction[];
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>({
  id: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  type: { type: String, required: true, enum: ['Credit', 'Debit'] },
  date: { type: Date, default: Date.now },
});

const WalletSchema = new Schema<IWallet>({
  userId: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  transactions: [TransactionSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const WalletModel = model<IWallet>('Wallet', WalletSchema);