// repositories/CourseRepository.ts
import Course, { ICourse } from '../models/Course.js';

class CourseRepository {
  // Get all courses
  async getAllCourses(): Promise<ICourse[]> {
    return await Course.find();
  }

  // Add a new course
  async addCourse(courseData: Partial<ICourse>): Promise<ICourse> {
    return await Course.create(courseData);
  }

  // Update an existing course by its custom 'id' (e.g., 'cs3380')
  async updateCourse(id: string, updateData: Partial<ICourse>): Promise<ICourse | null> {
    return await Course.findOneAndUpdate({ id: id }, updateData, { new: true });
  }
}

export default new CourseRepository();