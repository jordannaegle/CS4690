// models/Course.ts
import mongoose, { Schema } from 'mongoose';
// 2. Create the Schema using the interface
const courseSchema = new Schema({
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
export default mongoose.model('Course', courseSchema);
//# sourceMappingURL=Course.js.map