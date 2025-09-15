const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const { upload, handleUploadError, generateFilename } = require('../middleware/upload');
const { uploadLimiter, transformLimiter, userUploadLimiter, userTransformLimiter } = require('../middleware/rateLimiting');
const { cacheImageDetails, cacheUserImages, invalidateUserCache, invalidateImageCache } = require('../middleware/cache');
const { validate, validateQuery, transformationValidation, imageListValidation } = require('../utils/validation');
const Image = require('../models/Image');
const User = require('../models/User');
const imageProcessor = require('../utils/imageProcessor');
const s3Service = require('../utils/s3Service');
const { addTransformJob } = require('../utils/queue');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @route   POST /api/images
 * @desc    Upload a new image
 * @access  Private
 */
router.post('/', auth, uploadLimiter, userUploadLimiter, upload, handleUploadError, invalidateUserCache, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const user = await User.findById(req.user.id);
    
    // Check storage limit
    if (!user.hasStorageSpace(req.file.size)) {
      return res.status(400).json({
        success: false,
        message: 'Storage limit exceeded'
      });
    }

    // Generate unique filename
    const filename = generateFilename(req.file.originalname);
    const s3Key = `images/${req.user.id}/${filename}`;

    // Get image metadata
    const metadata = await imageProcessor.getMetadata(req.file.buffer);

    // Upload to S3
    const uploadResult = await s3Service.uploadFile(
      req.file.buffer,
      s3Key,
      req.file.mimetype
    );

    // Create image record
    const image = new Image({
      userId: req.user.id,
      originalName: req.file.originalname,
      filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      dimensions: {
        width: metadata.width,
        height: metadata.height
      },
      s3Key,
      s3Bucket: uploadResult.bucket,
      publicUrl: uploadResult.publicUrl,  // ✅ Fixed: was uploadResult.location
      metadata: {
        colorSpace: metadata.colorSpace,
        hasAlpha: metadata.hasAlpha,
        format: metadata.format,
        exif: metadata.exif
      }
    });

    await image.save();

    // Update user storage usage
    await user.updateStorageUsage(req.file.size);

    logger.info(`Image uploaded: ${filename} by user ${user.username}`);

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        image: {
          id: image._id,
          originalName: image.originalName,
          filename: image.filename,
          mimeType: image.mimeType,
          size: image.size,
          sizeFormatted: image.sizeFormatted,
          dimensions: image.dimensions,
          publicUrl: image.publicUrl,
          metadata: image.metadata,
          createdAt: image.createdAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/images/:id/transform
 * @desc    Apply transformations to an image (async with job queue)
 * @access  Private
 */
router.post('/:id/transform', auth, transformLimiter, userTransformLimiter, validate(transformationValidation), invalidateUserCache, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { transformations } = req.validatedBody;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image ID'
      });
    }

    // Find image
    const image = await Image.findOne({ _id: id, userId: req.user.id });
    
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Add transformation job to queue
    const job = await addTransformJob(id, transformations, req.user.id);

    logger.info(`Transformation job queued: ${job.id} for image ${image.filename} by user ${req.user.username}`);

    res.status(202).json({
      success: true,
      message: 'Transformation job queued successfully',
      data: {
        jobId: job.id,
        originalImage: {
          id: image._id,
          filename: image.filename,
          publicUrl: image.publicUrl
        },
        estimatedTime: '2-5 minutes'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/images/:id
 * @desc    Get image details
 * @access  Private
 */
router.get('/:id', auth, cacheImageDetails, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image ID'
      });
    }

    // Find image
    const image = await Image.findOne({ _id: id, userId: req.user.id });
    
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Increment download count
    await image.incrementDownloadCount();

    res.status(200).json({
      success: true,
      data: {
        image: {
          id: image._id,
          originalName: image.originalName,
          filename: image.filename,
          mimeType: image.mimeType,
          size: image.size,
          sizeFormatted: image.sizeFormatted,
          dimensions: image.dimensions,
          publicUrl: image.publicUrl,
          transformations: image.transformations,
          metadata: image.metadata,
          tags: image.tags,
          isPublic: image.isPublic,
          downloadCount: image.downloadCount,
          lastAccessed: image.lastAccessed,
          createdAt: image.createdAt,
          updatedAt: image.updatedAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/images
 * @desc    Get user's images with pagination
 * @access  Private
 */
router.get('/', auth, cacheUserImages, validateQuery(imageListValidation), async (req, res, next) => {
  try {
    const { page, limit, format, sortBy, sortOrder, tags } = req.validatedQuery;

    // Build filter query
    const filters = { userId: req.user.id };
    
    if (format) {
      filters.mimeType = new RegExp(`image/${format}`, 'i');
    }
    
    if (tags) {
      filters.tags = { $in: tags.split(',').map(tag => tag.trim()) };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get total count
    const totalImages = await Image.countDocuments(filters);
    const totalPages = Math.ceil(totalImages / limit);

    // Get images
    const images = await Image.find(filters)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-__v');

    // Get user storage info
    const storageInfo = await Image.getUserStorageUsage(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        images: images.map(image => ({
          id: image._id,
          originalName: image.originalName,
          filename: image.filename,
          mimeType: image.mimeType,
          size: image.size,
          sizeFormatted: image.sizeFormatted,
          dimensions: image.dimensions,
          publicUrl: image.publicUrl,
          transformations: image.transformations,
          tags: image.tags,
          isPublic: image.isPublic,
          downloadCount: image.downloadCount,
          lastAccessed: image.lastAccessed,
          createdAt: image.createdAt
        })),
        pagination: {
          currentPage: page,
          totalPages,
          totalImages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          nextPage: page < totalPages ? page + 1 : null,
          prevPage: page > 1 ? page - 1 : null
        },
        storage: {
          used: storageInfo.totalSize,
          limit: req.user.storageLimit,
          available: req.user.storageLimit - storageInfo.totalSize,
          count: storageInfo.count
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/images/:id
 * @desc    Delete an image
 * @access  Private
 */
router.delete('/:id', auth, invalidateUserCache, invalidateImageCache, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image ID'
      });
    }

    // Find image
    const image = await Image.findOne({ _id: id, userId: req.user.id });
    
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Delete from S3
    await s3Service.deleteFile(image.s3Key);

    // Update user storage usage
    const user = await User.findById(req.user.id);
    await user.updateStorageUsage(-image.size);

    // Delete from database
    await Image.findByIdAndDelete(id);

    logger.info(`Image deleted: ${image.filename} by user ${user.username}`);

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/images/:id/tags
 * @desc    Update image tags
 * @access  Private
 */
router.put('/:id/tags', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image ID'
      });
    }

    // Validate tags
    if (!Array.isArray(tags)) {
      return res.status(400).json({
        success: false,
        message: 'Tags must be an array'
      });
    }

    // Find and update image
    const image = await Image.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { tags: tags.filter(tag => tag.trim()).slice(0, 10) }, // Limit to 10 tags
      { new: true }
    );
    
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Image tags updated successfully',
      data: {
        image: {
          id: image._id,
          tags: image.tags,
          updatedAt: image.updatedAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/images/:id/visibility
 * @desc    Update image visibility (public/private)
 * @access  Private
 */
router.put('/:id/visibility', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isPublic } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image ID'
      });
    }

    // Find and update image
    const image = await Image.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { isPublic: Boolean(isPublic) },
      { new: true }
    );
    
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Image visibility updated successfully',
      data: {
        image: {
          id: image._id,
          isPublic: image.isPublic,
          updatedAt: image.updatedAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
