const mongoose = require('mongoose');

const transformationSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['resize', 'crop', 'rotate', 'watermark', 'flip', 'mirror', 'compress', 'format', 'filter']
  },
  parameters: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  appliedAt: {
    type: Date,
    default: Date.now
  }
});

const imageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  originalName: {
    type: String,
    required: true
  },
  filename: {
    type: String,
    required: true,
    unique: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  dimensions: {
    width: Number,
    height: Number
  },
  s3Key: {
    type: String,
    required: true
  },
  s3Bucket: {
    type: String,
    required: true
  },
  publicUrl: {
    type: String,
    required: true
  },
  transformations: [transformationSchema],
  metadata: {
    colorSpace: String,
    hasAlpha: Boolean,
    format: String,
    quality: Number,
    exif: mongoose.Schema.Types.Mixed
  },
  tags: [{
    type: String,
    trim: true
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  lastAccessed: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes for efficient queries
imageSchema.index({ userId: 1, createdAt: -1 });
imageSchema.index({ userId: 1, filename: 1 });
imageSchema.index({ tags: 1 });

// Update updatedAt on save
imageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for file size in human readable format
imageSchema.virtual('sizeFormatted').get(function() {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  let size = this.size;
  let sizeIndex = 0;
  
  while (size >= 1024 && sizeIndex < sizes.length - 1) {
    size /= 1024;
    sizeIndex++;
  }
  
  return `${Math.round(size * 100) / 100} ${sizes[sizeIndex]}`;
});

// Method to add transformation
imageSchema.methods.addTransformation = function(type, parameters) {
  this.transformations.push({
    type,
    parameters,
    appliedAt: new Date()
  });
  return this.save();
};

// Method to increment download count
imageSchema.methods.incrementDownloadCount = function() {
  this.downloadCount += 1;
  this.lastAccessed = new Date();
  return this.save();
};

// Static method to find user's images with pagination
imageSchema.statics.findUserImages = function(userId, page = 1, limit = 10, filters = {}) {
  const skip = (page - 1) * limit;
  const query = { userId, ...filters };
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('userId', 'username');
};

// Static method to get user's storage usage
imageSchema.statics.getUserStorageUsage = async function(userId) {
  const result = await this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId) } },
    { $group: { _id: null, totalSize: { $sum: '$size' }, count: { $sum: 1 } } }
  ]);
  
  return result[0] || { totalSize: 0, count: 0 };
};

module.exports = mongoose.model('Image', imageSchema);
