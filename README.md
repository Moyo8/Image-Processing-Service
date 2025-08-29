# Image Processing Service

A comprehensive backend service for image processing with user authentication, similar to Cloudinary.

## Features

- **User Authentication**: JWT-based authentication with sign-up and login
- **Image Management**: Upload, transform, retrieve, and list images
- **Image Transformations**: Resize, crop, rotate, watermark, flip, mirror, compress, format conversion, and filters
- **Cloud Storage**: aws integration for scalable image storage
- **Rate Limiting**: Protection against abuse
- **Caching**: Redis caching for improved performance
- **Async Processing**: Background job processing with Bull queue

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT
- **Image Processing**: Sharp
- **Cloud Storage**: AWS S3
- **Caching**: Redis
- **Queue**: Bull (Redis-based)
- **Validation**: Joi & Express Validator

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables (see `.env.example`)
4. Start the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/image-processing-service

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# AWS S3
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket-name

# Redis
REDIS_URL=redis://localhost:6379

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Images
- `POST /api/images` - Upload image
- `POST /api/images/:id/transform` - Apply transformations
- `GET /api/images/:id` - Retrieve image
- `GET /api/images` - List user's images (paginated)

## Usage

### Register a User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "user1", "password": "password123"}'
```

### Upload an Image
```bash
curl -X POST http://localhost:3000/api/images \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@path/to/your/image.jpg"
```

### Transform an Image
```bash
curl -X POST http://localhost:3000/api/images/IMAGE_ID/transform \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transformations": {
      "resize": {"width": 800, "height": 600},
      "format": "webp",
      "filters": {"grayscale": true}
    }
  }'
```

## License

MIT
