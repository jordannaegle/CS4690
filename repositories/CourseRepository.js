// repositories/CourseRepository.ts
import Course from '../models/Course.js';
class CourseRepository {
    // Get all courses
    async getAllCourses() {
        return await Course.find();
    }
    // Add a new course
    async addCourse(courseData) {
        return await Course.create(courseData);
    }
    // Update an existing course by its custom 'id' (e.g., 'cs3380')
    async updateCourse(id, updateData) {
        return await Course.findOneAndUpdate({ id: id }, updateData, { new: true });
    }
}
export default new CourseRepository();
//# sourceMappingURL=CourseRepository.js.map