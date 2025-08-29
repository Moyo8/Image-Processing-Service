const Joi = require('joi');

// User registration validation
const registerValidation = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': 'Username must only contain alphanumeric characters',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username cannot exceed 30 characters',
      'any.required': 'Username is required'
    }),
  email: Joi.string()
    .email()
    .optional()
    .messages({
      'string.email': 'Please provide a valid email address'
    }),
  password: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'string.max': 'Password cannot exceed 128 characters',
      'any.required': 'Password is required'
    })
});

// User login validation
const loginValidation = Joi.object({
  username: Joi.string()
    .required()
    .messages({
      'any.required': 'Username is required'
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    })
});

// Image transformation validation
const transformationValidation = Joi.object({
  transformations: Joi.object({
    resize: Joi.object({
      width: Joi.number().integer().min(1).max(4000),
      height: Joi.number().integer().min(1).max(4000),
      fit: Joi.string().valid('cover', 'contain', 'fill', 'inside', 'outside').default('inside'),
      withoutEnlargement: Joi.boolean().default(true)
    }).and('width', 'height'),
    
    crop: Joi.object({
      width: Joi.number().integer().min(1).required(),
      height: Joi.number().integer().min(1).required(),
      x: Joi.number().integer().min(0).default(0),
      y: Joi.number().integer().min(0).default(0)
    }),
    
    rotate: Joi.number().min(-360).max(360),
    
    flip: Joi.boolean(),
    
    mirror: Joi.boolean(),
    
    filters: Joi.object({
      grayscale: Joi.boolean(),
      sepia: Joi.boolean(),
      blur: Joi.number().min(0.3).max(1000),
      sharpen: Joi.boolean(),
      brightness: Joi.number().min(0.1).max(3),
      contrast: Joi.number().min(0.1).max(3),
      saturation: Joi.number().min(0).max(3)
    }),
    
    format: Joi.string().valid('jpeg', 'jpg', 'png', 'webp', 'avif'),
    
    formatOptions: Joi.object({
      quality: Joi.number().integer().min(1).max(100),
      progressive: Joi.boolean(),
      compressionLevel: Joi.number().integer().min(0).max(9),
      lossless: Joi.boolean()
    }),
    
    compress: Joi.object({
      quality: Joi.number().integer().min(1).max(100).default(80),
      format: Joi.string().valid('jpeg', 'jpg', 'png', 'webp', 'avif')
    }),
    
    watermark: Joi.object({
      text: Joi.string().max(100),
      options: Joi.object({
        gravity: Joi.string().valid(
          'north', 'northeast', 'east', 'southeast', 
          'south', 'southwest', 'west', 'northwest', 'center'
        ).default('southeast'),
        opacity: Joi.number().min(0).max(1).default(0.5)
      })
    })
  }).required()
});

// Image list query validation
const imageListValidation = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  format: Joi.string().valid('jpeg', 'jpg', 'png', 'webp', 'gif', 'avif'),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'size', 'downloadCount').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  tags: Joi.string()
});

// Validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    req.validatedBody = value;
    next();
  };
};

// Query validation middleware
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Query validation error',
        errors
      });
    }

    req.validatedQuery = value;
    next();
  };
};

module.exports = {
  registerValidation,
  loginValidation,
  transformationValidation,
  imageListValidation,
  validate,
  validateQuery
};
