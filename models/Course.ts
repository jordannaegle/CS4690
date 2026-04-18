import mongoose, { Document, Schema, Types } from 'mongoose';
import { TenantKey } from '../domain.js';

export interface ICourse extends Document {
  tenant: TenantKey;
  code: string;
  title: string;
  teacherId: Types.ObjectId;
  createdById: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const courseSchema: Schema<ICourse> = new Schema(
  {
    tenant: {
      type: String,
      enum: ['uvu', 'uofu'],
      required: true
    },
    code: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

courseSchema.index({ tenant: 1, code: 1 }, { unique: true });

export default mongoose.model<ICourse>('Course', courseSchema);
