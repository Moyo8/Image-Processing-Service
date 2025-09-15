const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const logger = require('./logger');

const s3Client = new S3Client({
  region: process.env.AWS_REGION ||'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

class S3Service {
  constructor() {
    this.bucketName = process.env.S3_BUCKET_NAME;
    this.region = process.env.AWS_REGION || 'us-east-1';
  }

  /**
   * Upload file to S3
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} key - S3 object key
   * @param {string} contentType - File content type
   * @returns {Promise<Object>} Upload result with public URL
   */
  async uploadFile(fileBuffer, key, contentType) {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      });
      await s3Client.send(command);
      
      // Generate public URL
      const publicUrl = this.generatePublicUrl(key);
      
      logger.info(`File uploaded successfully to S3: ${key}`);
      return {
        success: true,
        key,
        bucket: this.bucketName,
        publicUrl: publicUrl  // ✅ Added public URL to return object
      };
    } catch (error) {
      logger.error('S3 upload error:', error);
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  /**
   * Generate public URL for S3 object
   * @param {string} key - S3 object key
   * @returns {string} Public URL
   */
  generatePublicUrl(key) {
    // For us-east-1, we can use the shorter format
    if (this.region === 'us-east-1') {
      return `https://${this.bucketName}.s3.amazonaws.com/${key}`;
    }
    // For other regions, include the region in the URL
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Download file from S3
   * @param {string} key - S3 object key
   * @returns {Promise<Buffer>} File buffer
   */
  async downloadFile(key) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });
      const result = await s3Client.send(command);
      logger.info(`File downloaded successfully from S3: ${key}`);
      // result.Body is a stream in v3, so we need to convert it to Buffer
      const chunks = [];
      for await (const chunk of result.Body) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      logger.error('S3 download error:', error);
      throw new Error(`Failed to download file from S3: ${error.message}`);
    }
  }

  /**
   * Delete file from S3
   * @param {string} key - S3 object key
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });
      await s3Client.send(command);
      logger.info(`File deleted successfully from S3: ${key}`);
      return true;
    } catch (error) {
      logger.error('S3 delete error:', error);
      throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
  }

  /**
   * Get signed URL for private access
   * @param {string} key - S3 object key
   * @param {number} expiresIn - URL expiration time in seconds
   * @returns {string} Signed URL
   */
  async getSignedUrl(key, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });
    return await getSignedUrl(s3Client, command, { expiresIn });
  }

  /**
   * Check if file exists in S3
   * @param {string} key - S3 object key
   * @returns {Promise<boolean>} File exists status
   */
  async fileExists(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });
      await s3Client.send(command);
      return true;
    } catch (error) {
      if (error.$metadata && error.$metadata.httpStatusCode === 404) {
        return false;
      }
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata
   * @param {string} key - S3 object key
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });
      const result = await s3Client.send(command);
      return {
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        lastModified: result.LastModified,
        etag: result.ETag
      };
    } catch (error) {
      logger.error('S3 metadata error:', error);
      throw new Error(`Failed to get file metadata from S3: ${error.message}`);
    }
  }
}

module.exports = new S3Service();
