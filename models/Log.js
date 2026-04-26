import mongoose, { Schema } from 'mongoose';
const logSchema = new Schema({
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
    studentId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    authorId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        required: true,
        trim: true
    }
}, { timestamps: true });
export default mongoose.model('Log', logSchema);
//# sourceMappingURL=Log.js.map