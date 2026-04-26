import mongoose, { Document, Schema } from 'mongoose';
import { TenantKey, UserRole } from '../domain.js';

export interface IUser extends Document {
  tenant: TenantKey;
  username: string;
  displayName: string;
  role: UserRole;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema: Schema<IUser> = new Schema(
  {
    tenant: {
      type: String,
      enum: ['uvu', 'uofu'],
      required: true
    },
    username: {
      type: String,
      required: true,
      trim: true
    },
    displayName: {
      type: String,
      required: true,
      trim: true
    },
    role: {
      type: String,
      enum: ['admin', 'teacher', 'ta', 'student'],
      required: true
    },
    passwordHash: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

userSchema.index({ tenant: 1, username: 1 }, { unique: true });

export default mongoose.model<IUser>('User', userSchema);
