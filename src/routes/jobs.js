const express = require('express');
const auth = require('../middleware/auth');
const { imageProcessingQueue } = require('../utils/queue');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @route   GET /api/jobs/:id
 * @desc    Get job status
 * @access  Private
 */
router.get('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const job = await imageProcessingQueue.getJob(id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    const state = await job.getState();
    
    res.status(200).json({
      success: true,
      data: {
        job: {
          id: job.id,
          type: job.name,
          state,
          progress: job._progress,
          data: job.data,
          createdAt: new Date(job.timestamp),
          processedOn: job.processedOn ? new Date(job.processedOn) : null,
          finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
          failedReason: job.failedReason
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/jobs
 * @desc    Get user's jobs
 * @access  Private
 */
router.get('/', auth, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, state } = req.query;
    
    // Get all jobs (this is a simplified version - in production you'd want better filtering)
    const jobs = await imageProcessingQueue.getJobs(
      state ? [state] : ['waiting', 'active', 'completed', 'failed'],
      parseInt((page - 1) * limit),
      parseInt(limit)
    );

    // Filter jobs by user (checking job.data.userId)
    const userJobs = jobs.filter(job => 
      job.data && job.data.userId === req.user.id.toString()
    );

    const jobsData = await Promise.all(
      userJobs.map(async (job) => {
        const state = await job.getState();
        return {
          id: job.id,
          type: job.name,
          state,
          progress: job._progress,
          data: job.data,
          createdAt: new Date(job.timestamp),
          processedOn: job.processedOn ? new Date(job.processedOn) : null,
          finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
          failedReason: job.failedReason
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        jobs: jobsData,
        pagination: {
          currentPage: parseInt(page),
          totalJobs: userJobs.length
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
