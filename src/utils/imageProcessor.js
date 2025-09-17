const sharp = require('sharp');
const logger = require('./logger');

class ImageProcessor {
  constructor() {
    this.maxDimension = parseInt(process.env.MAX_IMAGE_DIMENSION) || 4000;
    this.defaultQuality = parseInt(process.env.DEFAULT_QUALITY) || 80;
  }

  /**
   * Get image metadata
   * @param {Buffer} imageBuffer - Image buffer
   * @returns {Promise<Object>} Image metadata
   */
  async getMetadata(imageBuffer) {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        colorSpace: metadata.space,
        hasAlpha: metadata.hasAlpha,
        density: metadata.density,
        exif: metadata.exif
      };
    } catch (error) {
      logger.error('Image metadata extraction error:', error);
      throw new Error(`Failed to extract image metadata: ${error.message}`);
    }
  }

  /**
   * Resize image
   * @param {Buffer} imageBuffer - Image buffer
   * @param {Object} options - Resize options
   * @returns {Promise<Buffer>} Processed image buffer
   */
  async resize(imageBuffer, options) {
    try {
      const { width, height, fit = 'inside', withoutEnlargement = true } = options;
      
      // Validate dimensions
      if (width > this.maxDimension || height > this.maxDimension) {
        throw new Error(`Maximum dimension allowed is ${this.maxDimension}px`);
      }

      const sharpInstance = sharp(imageBuffer);
      
      if (width || height) {
        sharpInstance.resize(width, height, { fit, withoutEnlargement });
      }

      return await sharpInstance.toBuffer();
    } catch (error) {
      logger.error('Image resize error:', error);
      throw new Error(`Failed to resize image: ${error.message}`);
    }
  }

  /**
   * Crop image
   * @param {Buffer} imageBuffer - Image buffer
   * @param {Object} options - Crop options
   * @returns {Promise<Buffer>} Processed image buffer
   */
  async crop(imageBuffer, options) {
    try {
      const { width, height, x = 0, y = 0 } = options;
      
      if (!width || !height) {
        throw new Error('Width and height are required for cropping');
      }

      return await sharp(imageBuffer)
        .extract({ left: x, top: y, width, height })
        .toBuffer();
    } catch (error) {
      logger.error('Image crop error:', error);
      throw new Error(`Failed to crop image: ${error.message}`);
    }
  }

  /**
   * Rotate image
   * @param {Buffer} imageBuffer - Image buffer
   * @param {number} angle - Rotation angle in degrees
   * @returns {Promise<Buffer>} Processed image buffer
   */
  async rotate(imageBuffer, angle) {
    try {
      return await sharp(imageBuffer)
        .rotate(angle)
        .toBuffer();
    } catch (error) {
      logger.error('Image rotate error:', error);
      throw new Error(`Failed to rotate image: ${error.message}`);
    }
  }

  /**
   * Flip image horizontally
   * @param {Buffer} imageBuffer - Image buffer
   * @returns {Promise<Buffer>} Processed image buffer
   */
  async flip(imageBuffer) {
    try {
      return await sharp(imageBuffer)
        .flip()
        .toBuffer();
    } catch (error) {
      logger.error('Image flip error:', error);
      throw new Error(`Failed to flip image: ${error.message}`);
    }
  }

  /**
   * Mirror image vertically
   * @param {Buffer} imageBuffer - Image buffer
   * @returns {Promise<Buffer>} Processed image buffer
   */
  async mirror(imageBuffer) {
    try {
      return await sharp(imageBuffer)
        .flop()
        .toBuffer();
    } catch (error) {
      logger.error('Image mirror error:', error);
      throw new Error(`Failed to mirror image: ${error.message}`);
    }
  }

  /**
   * Apply filters to image
   * @param {Buffer} imageBuffer - Image buffer
   * @param {Object} filters - Filter options
   * @returns {Promise<Buffer>} Processed image buffer
   */
  async applyFilters(imageBuffer, filters) {
    try {
      let sharpInstance = sharp(imageBuffer);

      if (filters.grayscale) {
        sharpInstance = sharpInstance.grayscale();
      }

      if (filters.sepia) {
        sharpInstance = sharpInstance.tint({ r: 255, g: 238, b: 196 });
      }

      if (filters.blur) {
        const blurAmount = typeof filters.blur === 'number' ? filters.blur : 1;
        sharpInstance = sharpInstance.blur(blurAmount);
      }

      if (filters.sharpen) {
        sharpInstance = sharpInstance.sharpen();
      }

      if (filters.brightness) {
        sharpInstance = sharpInstance.modulate({ brightness: filters.brightness });
      }

      if (filters.contrast) {
        const contrastFactor = filters.contrast;
        const intercept = 128 * (1 - contrastFactor);
        sharpInstance = sharpInstance.linear(contrastFactor, intercept);
      }

      if (filters.saturation) {
        sharpInstance = sharpInstance.modulate({ saturation: filters.saturation });
      }

      return await sharpInstance.toBuffer();
    } catch (error) {
      logger.error('Image filter error:', error);
      throw new Error(`Failed to apply filters: ${error.message}`);
    }
  }

  /**
   * Change image format
   * @param {Buffer} imageBuffer - Image buffer
   * @param {string} format - Target format (jpeg, png, webp, gif)
   * @param {Object} options - Format options
   * @returns {Promise<Buffer>} Processed image buffer
   */
  async changeFormat(imageBuffer, format, options = {}) {
    try {
      let sharpInstance = sharp(imageBuffer);
      
      switch (format.toLowerCase()) {
        case 'jpeg':
        case 'jpg':
          sharpInstance = sharpInstance.jpeg({ 
            quality: options.quality || this.defaultQuality,
            progressive: options.progressive || false
          });
          break;
        case 'png':
          sharpInstance = sharpInstance.png({ 
            compressionLevel: options.compressionLevel || 6,
            progressive: options.progressive || false
          });
          break;
        case 'webp':
          sharpInstance = sharpInstance.webp({ 
            quality: options.quality || this.defaultQuality,
            lossless: options.lossless || false
          });
          break;
        case 'avif':
          sharpInstance = sharpInstance.avif({ 
            quality: options.quality || this.defaultQuality
          });
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      return await sharpInstance.toBuffer();
    } catch (error) {
      logger.error('Image format conversion error:', error);
      throw new Error(`Failed to convert image format: ${error.message}`);
    }
  }

  /**
   * Compress image
   * @param {Buffer} imageBuffer - Image buffer
   * @param {Object} options - Compression options
   * @returns {Promise<Buffer>} Processed image buffer
   */
  async compress(imageBuffer, options = {}) {
    try {
      const { quality = this.defaultQuality, format } = options;
      const metadata = await sharp(imageBuffer).metadata();
      const originalFormat = format || metadata.format;

      return await this.changeFormat(imageBuffer, originalFormat, { quality });
    } catch (error) {
      logger.error('Image compression error:', error);
      throw new Error(`Failed to compress image: ${error.message}`);
    }
  }

  /**
   * Add watermark to image
   * @param {Buffer} imageBuffer - Image buffer
   * @param {Buffer} watermarkBuffer - Watermark image buffer
   * @param {Object} options - Watermark options
   * @returns {Promise<Buffer>} Processed image buffer
   */
  async addWatermark(imageBuffer, watermarkBuffer, options = {}) {
    try {
      const { gravity = 'southeast', opacity = 0.5 } = options;
      
      // Resize watermark to be proportional to the main image
      const imageMetadata = await sharp(imageBuffer).metadata();
      const watermarkWidth = Math.floor(imageMetadata.width * 0.2); // 20% of image width
      
      const processedWatermark = await sharp(watermarkBuffer)
        .resize(watermarkWidth)
        .composite([{
          input: Buffer.from([255, 255, 255, Math.floor(255 * (1 - opacity))]),
          raw: { width: 1, height: 1, channels: 4 },
          tile: true,
          blend: 'dest-in'
        }])
        .png()
        .toBuffer();

      return await sharp(imageBuffer)
        .composite([{ input: processedWatermark, gravity }])
        .toBuffer();
    } catch (error) {
      logger.error('Image watermark error:', error);
      throw new Error(`Failed to add watermark: ${error.message}`);
    }
  }

  /**
   * Apply multiple transformations
   * @param {Buffer} imageBuffer - Image buffer
   * @param {Object} transformations - Transformation options
   * @returns {Promise<Buffer>} Processed image buffer
   */
  async transform(imageBuffer, transformations) {
    try {
      let processedBuffer = imageBuffer;

      // Apply transformations in a specific order
      if (transformations.rotate) {
        processedBuffer = await this.rotate(processedBuffer, transformations.rotate);
      }

      if (transformations.flip) {
        processedBuffer = await this.flip(processedBuffer);
      }

      if (transformations.mirror) {
        processedBuffer = await this.mirror(processedBuffer);
      }

      if (transformations.crop) {
        processedBuffer = await this.crop(processedBuffer, transformations.crop);
      }

      if (transformations.resize) {
        processedBuffer = await this.resize(processedBuffer, transformations.resize);
      }

      if (transformations.filters) {
        processedBuffer = await this.applyFilters(processedBuffer, transformations.filters);
      }

      if (transformations.watermark && transformations.watermark.image) {
        processedBuffer = await this.addWatermark(
          processedBuffer, 
          transformations.watermark.image, 
          transformations.watermark.options
        );
      }

      if (transformations.compress) {
        processedBuffer = await this.compress(processedBuffer, transformations.compress);
      }

      if (transformations.format) {
        processedBuffer = await this.changeFormat(
          processedBuffer, 
          transformations.format, 
          transformations.formatOptions || {}
        );
      }

      return processedBuffer;
    } catch (error) {
      logger.error('Image transformation error:', error);
      throw new Error(`Failed to transform image: ${error.message}`);
    }
  }
}

module.exports = new ImageProcessor();
