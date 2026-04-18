// models/Course.ts
import mongoose, { Schema, Document } from 'mongoose';

// 1. Create an interface representing a document in MongoDB
export interface ICourse extends Document {
  id: string;
  display: string;
}

// 2. Create the Schema using the interface
const courseSchema: Schema = new Schema({
  id: { 
    type: String, 
    required: true, 
    unique: true 
  },
  display: { 
    type: String, 
    required: true 
  }
});

// 3. Export the strongly-typed model
export default mongoose.model<ICourse>('Course', courseSchema);