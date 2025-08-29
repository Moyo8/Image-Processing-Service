const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const imageRoutes = require('./routes/images');
const jobRoutes = require('./routes/jobs');
const analyticsRoutes = require('./routes/analytics');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiting');
// const cache = require('./utils/cache'); // Temporarily disabled
const logger = require('./utils/logger');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());

// Rate limiting
app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/analytics', analyticsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use(errorHandler);

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = () => {
  logger.info('Received shutdown signal, closing HTTP server...');
  server.close(() => {
    logger.info('HTTP server closed');
    mongoose.connection.close(() => {
      logger.info('MongoDB connection closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
    
    // Skip cache connection for now to get server running
    logger.info('Skipping cache connection for initial testing');
    
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
    
    global.server = server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;
