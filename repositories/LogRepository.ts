// repositories/LogRepository.ts
import Log, { ILog } from '../models/Log.js';

class LogRepository {
  // Get logs matching a specific course and student ID
  async getLogs(courseId: string, uvuId: string): Promise<ILog[]> {
    return await Log.find({ courseId, uvuId });
  }

  // Add a new log
  async addLog(logData: Partial<ILog>): Promise<ILog> {
    return await Log.create(logData);
  }
}

export default new LogRepository();