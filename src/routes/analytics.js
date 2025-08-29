const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Image = require('../models/Image');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get user dashboard analytics
 * @access  Private
 */
router.get('/dashboard', auth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get storage usage
    const storageStats = await Image.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalSize: { $sum: '$size' },
          totalImages: { $sum: 1 },
          avgSize: { $avg: '$size' }
        }
      }
    ]);

    // Get images by format
    const formatStats = await Image.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$mimeType',
          count: { $sum: 1 },
          totalSize: { $sum: '$size' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get upload trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const uploadTrends = await Image.aggregate([
      { 
        $match: { 
          userId: mongoose.Types.ObjectId(userId),
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 },
          size: { $sum: '$size' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get transformation stats
    const transformationStats = await Image.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      { $unwind: { path: '$transformations', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$transformations.type',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get most downloaded images
    const topImages = await Image.find({ userId })
      .sort({ downloadCount: -1 })
      .limit(5)
      .select('originalName downloadCount publicUrl createdAt');

    const storage = storageStats[0] || { totalSize: 0, totalImages: 0, avgSize: 0 };
    
    res.status(200).json({
      success: true,
      data: {
        storage: {
          used: storage.totalSize,
          limit: req.user.storageLimit,
          available: req.user.storageLimit - storage.totalSize,
          percentage: ((storage.totalSize / req.user.storageLimit) * 100).toFixed(2),
          imageCount: storage.totalImages,
          averageSize: Math.round(storage.avgSize || 0)
        },
        formats: formatStats,
        uploadTrends,
        transformations: transformationStats.filter(t => t._id !== null),
        topImages
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/analytics/storage
 * @desc    Get detailed storage analytics
 * @access  Private
 */
router.get('/storage', auth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Storage by month
    const storageByMonth = await Image.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalSize: { $sum: '$size' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Largest files
    const largestFiles = await Image.find({ userId })
      .sort({ size: -1 })
      .limit(10)
      .select('originalName size sizeFormatted dimensions createdAt');

    // Storage by transformation type
    const transformationStorage = await Image.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      { $unwind: { path: '$transformations', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$transformations.type',
          totalSize: { $sum: '$size' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalSize: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        monthlyBreakdown: storageByMonth,
        largestFiles,
        transformationBreakdown: transformationStorage.filter(t => t._id !== null)
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
