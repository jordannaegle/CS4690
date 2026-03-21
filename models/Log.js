// models/Log.ts
import mongoose, { Schema } from 'mongoose';
// 2. Create the Schema
const logSchema = new Schema({
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
export default mongoose.model('Log', logSchema);
//# sourceMappingURL=Log.js.map