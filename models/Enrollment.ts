import mongoose, { Document, Schema, Types } from 'mongoose';
import { MembershipRole, TenantKey } from '../domain.js';

export interface IEnrollment extends Document {
  tenant: TenantKey;
  courseId: Types.ObjectId;
  userId: Types.ObjectId;
  role: MembershipRole;
  createdAt: Date;
  updatedAt: Date;
}

const enrollmentSchema: Schema<IEnrollment> = new Schema(
  {
    tenant: {
      type: String,
      enum: ['uvu', 'uofu'],
      required: true
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['teacher', 'ta', 'student'],
      required: true
    }
  },
  { timestamps: true }
);

enrollmentSchema.index({ tenant: 1, courseId: 1, userId: 1 }, { unique: true });

export default mongoose.model<IEnrollment>('Enrollment', enrollmentSchema);
