const Queue = require('bull');
const redis = require('redis');
const { URL } = require('url');
const imageProcessor = require('../utils/imageProcessor');
const s3Service = require('../utils/s3Service');
const Image = require('../models/Image');
const User = require('../models/User');
const logger = require('../utils/logger');

// Create Redis connection for Bull
// Support either individual host/port/password env vars OR a single REDIS_URL
function sanitizeRedisUrl(raw) {
  if (!raw) return null;
  let s = raw.trim();
  if (s.startsWith('<') && s.endsWith('>')) s = s.slice(1, -1);
  s = s.replace(/<([^>]+)>/g, '$1');
  return s;
}

let redisConfig;
const rawRedisUrl = process.env.REDIS_URL || null;
const redisUrl = sanitizeRedisUrl(rawRedisUrl);
if (redisUrl) {
  // pass options through to ioredis via Bull
  // important: set maxRetriesPerRequest to null to avoid the default 20 retries limit
  // and add a retryStrategy so the client will attempt reconnects gracefully
  // Also detect rediss:// (TLS) and add a tls.servername for SNI if available (Redis Cloud)
  let parsed;
  try {
    parsed = new URL(redisUrl);
  } catch (e) {
    parsed = null;
  }

  const redisOptions = {
    url: redisUrl,
    maxRetriesPerRequest: null,
    // Reduce long hangs while trying to connect; 10s is a reasonable default
    socket: { connectTimeout: 10000 },
    // retryStrategy receives times => milliseconds to wait before reconnect
    retryStrategy: function (times) {
      // exponential backoff capped at 30s
      const delay = Math.min(30000, Math.pow(2, times) * 100);
      return delay;
    }
  };

  if (parsed && parsed.protocol === 'rediss:') {
    // ioredis accepts a `tls` object to enable TLS SNI; include servername to help with some providers
    redisOptions.tls = { servername: parsed.hostname, rejectUnauthorized: false };
  }

  redisConfig = { redis: redisOptions };
} else {
  redisConfig = {
    redis: {
      port: process.env.REDIS_PORT || 6379,
      host: process.env.REDIS_HOST || 'localhost',
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      retryStrategy: function (times) {
        return Math.min(30000, Math.pow(2, times) * 100);
      }
    }
  };
}

// Create queue with robust Redis options
const imageProcessingQueue = new Queue('image processing', redisConfig);

// Process image transformation jobs
imageProcessingQueue.process('transform', async (job) => {
  const { imageId, transformations, userId } = job.data;
  
  try {
    logger.info(`Processing transformation job for image ${imageId}`);
    
    // Update job progress
    job.progress(10);
    
    // Find the original image
    const image = await Image.findById(imageId);
    if (!image) {
      throw new Error('Image not found');
    }
    
    job.progress(20);
    
    // Download original image from S3
  const originalBuffer = await s3Service.downloadFile(image.s3Key);
    
    job.progress(40);
    
    // Apply transformations
    const transformedBuffer = await imageProcessor.transform(originalBuffer, transformations);
    
    job.progress(60);
    
    // Generate new filename for transformed image
    const transformedFilename = `transformed_${Date.now()}_${image.filename}`;
    const transformedS3Key = `images/${userId}/transformed/${transformedFilename}`;
    
    // Determine MIME type for transformed image
    let mimeType = image.mimeType;
    if (transformations.format) {
      const formatMimeTypes = {
        'jpeg': 'image/jpeg',
        'jpg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp',
        'avif': 'image/avif'
      };
      mimeType = formatMimeTypes[transformations.format.toLowerCase()] || image.mimeType;
    }
    
    job.progress(70);
    
    // Upload transformed image to S3
  const uploadResult = await s3Service.uploadFile(
      transformedBuffer,
      transformedS3Key,
      mimeType
    );
    
    job.progress(80);
    
    // Get metadata of transformed image
    const transformedMetadata = await imageProcessor.getMetadata(transformedBuffer);
    
    // Create new image record for transformed image
    const transformedImage = new Image({
      userId,
      originalName: `transformed_${image.originalName}`,
      filename: transformedFilename,
      mimeType,
      size: transformedBuffer.length,
      dimensions: {
        width: transformedMetadata.width,
        height: transformedMetadata.height
      },
      s3Key: transformedS3Key,
      s3Bucket: uploadResult.bucket,
      publicUrl: uploadResult.location,
      metadata: {
        colorSpace: transformedMetadata.colorSpace,
        hasAlpha: transformedMetadata.hasAlpha,
        format: transformedMetadata.format
      },
      transformations: Object.keys(transformations).map(type => ({
        type,
        parameters: transformations[type]
      }))
    });
    
    await transformedImage.save();
    
    job.progress(90);
    
    // Update user storage usage
    const user = await User.findById(userId);
    await user.updateStorageUsage(transformedBuffer.length);
    
    job.progress(100);
    
    logger.info(`Transformation job completed for image ${imageId}`);
    
    return {
      success: true,
      transformedImageId: transformedImage._id,
      publicUrl: transformedImage.publicUrl
    };
    
  } catch (error) {
    logger.error(`Transformation job failed for image ${imageId}:`, error);
    throw error;
  }
});

// Process image optimization jobs
imageProcessingQueue.process('optimize', async (job) => {
  const { imageId } = job.data;
  
  try {
    logger.info(`Processing optimization job for image ${imageId}`);
    
    job.progress(10);
    
    const image = await Image.findById(imageId);
    if (!image) {
      throw new Error('Image not found');
    }
    
    job.progress(30);
    
    // Download original image
  const originalBuffer = await s3Service.downloadFile(image.s3Key);
    
    job.progress(50);
    
    // Apply optimization (compress with good quality)
    const optimizedBuffer = await imageProcessor.compress(originalBuffer, {
      quality: 85,
      format: image.metadata.format
    });
    
    job.progress(70);
    
    // Only replace if optimization actually reduces size significantly
    if (optimizedBuffer.length < image.size * 0.8) {
      // Upload optimized version
  await s3Service.uploadFile(
        optimizedBuffer,
        image.s3Key,
        image.mimeType
      );
      
      // Update image record
      const sizeDifference = image.size - optimizedBuffer.length;
      image.size = optimizedBuffer.length;
      await image.save();
      
      // Update user storage usage
      const user = await User.findById(image.userId);
      await user.updateStorageUsage(-sizeDifference);
      
      logger.info(`Image optimized: saved ${sizeDifference} bytes`);
    }
    
    job.progress(100);
    
    return { success: true, optimized: true };
    
  } catch (error) {
    logger.error(`Optimization job failed for image ${imageId}:`, error);
    throw error;
  }
});

// Job event handlers
imageProcessingQueue.on('completed', (job, result) => {
  logger.info(`Job ${job.id} completed:`, result);
});

imageProcessingQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed:`, err);
});

imageProcessingQueue.on('stalled', (job) => {
  logger.warn(`Job ${job.id} stalled`);
});

// Clean up completed jobs after 24 hours
imageProcessingQueue.clean(24 * 60 * 60 * 1000, 'completed');
imageProcessingQueue.clean(24 * 60 * 60 * 1000, 'failed');

module.exports = {
  imageProcessingQueue,
  
  // Add a transformation job
  addTransformJob: (imageId, transformations, userId) => {
    return imageProcessingQueue.add('transform', {
      imageId,
      transformations,
      userId
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: true,
      removeOnFail: false
    });
  },
  
  // Add an optimization job
  addOptimizeJob: (imageId) => {
    return imageProcessingQueue.add('optimize', {
      imageId
    }, {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: true,
      removeOnFail: false
    });
  },
  
  // Get job status
  getJobStatus: async (jobId) => {
    const job = await imageProcessingQueue.getJob(jobId);
    if (!job) {
      return null;
    }
    
    return {
      id: job.id,
      progress: job._progress,
      state: await job.getState(),
      data: job.data,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason
    };
  }
};
