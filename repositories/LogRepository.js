// repositories/LogRepository.ts
import Log from '../models/Log.js';
class LogRepository {
    // Get logs matching a specific course and student ID
    async getLogs(courseId, uvuId) {
        return await Log.find({ courseId, uvuId });
    }
    // Add a new log
    async addLog(logData) {
        return await Log.create(logData);
    }
}
export default new LogRepository();
//# sourceMappingURL=LogRepository.js.map