// models/message.model.ts
import { Schema, model, Document, Types } from "mongoose";

export interface IMessage extends Document {
  conversationId: string;
  senderId: Types.ObjectId;
  content: string;
  messageType: 'text' | 'image' | 'file';
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPopulatedSender {
  _id: Types.ObjectId;
  fullName: string;
  profilePicture?: string;
}

export interface IPopulatedMessage extends Document {
  conversationId: string;
  senderId: IPopulatedSender;
  content: string;
  messageType: 'text' | 'image' | 'file';
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>({
  conversationId: { 
    type: String, 
    required: true,
    index: true 
  },
  senderId: { 
    type: Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  content: { 
    type: String, 
    required: function(this: IMessage) {
      return this.messageType === 'text';
    } 
  },
  messageType: { 
    type: String, 
    enum: ['text', 'image', 'file'], 
    default: 'text' 
  },
  imageUrl: { 
    type: String 
  },
  fileUrl: { 
    type: String 
  },
  fileName: { 
    type: String 
  },
  isDeleted: { 
    type: Boolean, 
    default: false 
  },
  deletedAt: { 
    type: Date 
  },
  deletedBy: { 
    type: Schema.Types.ObjectId, 
    ref: "User" 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update the updatedAt field before saving
messageSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for better query performance
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, isDeleted: 1 });

export const Message = model<IMessage>("Message", messageSchema);
export default IMessage;