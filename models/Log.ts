// models/Log.ts
import mongoose, { Schema, Document } from 'mongoose';

// 1. Create the interface
export interface ILog extends Document {
  courseId: string;
  uvuId: string;
  date: string;
  text: string;
}

// 2. Create the Schema
const logSchema: Schema = new Schema({
  courseId: { 
    type: String, 
    required: true 
  },
  uvuId: { 
    type: String, 
    required: true 
  },
  date: { 
    type: String, 
    required: true 
  },
  text: { 
    type: String, 
    required: true 
  }
});

// 3. Export the strongly-typed model
export default mongoose.model<ILog>('Log', logSchema);