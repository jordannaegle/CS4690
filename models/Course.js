import mongoose, { Schema } from 'mongoose';
const courseSchema = new Schema({
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
}, { timestamps: true });
courseSchema.index({ tenant: 1, code: 1 }, { unique: true });
export default mongoose.model('Course', courseSchema);
//# sourceMappingURL=Course.js.map