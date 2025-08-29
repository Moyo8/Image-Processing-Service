const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class LocalStorageService {
  constructor() {
    this.storageDir = path.join(__dirname, '../../storage');
    this.ensureStorageDir();
  }

  ensureStorageDir() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  async uploadFile(fileBuffer, key, contentType) {
    try {
      const filePath = path.join(this.storageDir, key);
      const dir = path.dirname(filePath);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, fileBuffer);
      
      logger.info(`File uploaded locally: ${key}`);
      
      return {
        success: true,
        location: `http://localhost:3000/storage/${key}`,
        key: key,
        bucket: 'local'
      };
    } catch (error) {
      logger.error('Local storage upload error:', error);
      throw new Error(`Failed to upload file locally: ${error.message}`);
    }
  }

  async downloadFile(key) {
    try {
      const filePath = path.join(this.storageDir, key);
      return fs.readFileSync(filePath);
    } catch (error) {
      logger.error('Local storage download error:', error);
      throw new Error(`Failed to download file locally: ${error.message}`);
    }
  }

  async deleteFile(key) {
    try {
      const filePath = path.join(this.storageDir, key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`File deleted locally: ${key}`);
      }
      return true;
    } catch (error) {
      logger.error('Local storage delete error:', error);
      throw new Error(`Failed to delete file locally: ${error.message}`);
    }
  }

  async fileExists(key) {
    const filePath = path.join(this.storageDir, key);
    return fs.existsSync(filePath);
  }
}

module.exports = new LocalStorageService();
