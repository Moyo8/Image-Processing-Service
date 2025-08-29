# API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Rate Limits

- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 5 requests per 15 minutes per IP
- **Upload**: 50 uploads per hour per IP
- **Transform**: 100 transformations per hour per IP
- **User Upload**: 100 uploads per hour per user
- **User Transform**: 200 transformations per hour per user

## Endpoints

### Authentication

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "username": "string (3-30 chars, alphanumeric)",
  "password": "string (6-128 chars)",
  "email": "string (optional, valid email)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "string",
      "username": "string",
      "email": "string",
      "storageUsed": 0,
      "storageLimit": 1073741824,
      "createdAt": "datetime"
    },
    "token": "jwt-token"
  }
}
```

#### Login User
```http
POST /auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}
```

**Response:** Same as register

#### Get Current User
```http
GET /auth/me
Authorization: Bearer <token>
```

#### Update Profile
```http
PUT /auth/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "string (optional)"
}
```

### Images

#### Upload Image
```http
POST /images
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- image: file (jpeg, png, webp, gif, max 10MB)
```

**Response:**
```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "image": {
      "id": "string",
      "originalName": "string",
      "filename": "string",
      "mimeType": "string",
      "size": "number",
      "sizeFormatted": "string",
      "dimensions": {
        "width": "number",
        "height": "number"
      },
      "publicUrl": "string",
      "metadata": "object",
      "createdAt": "datetime"
    }
  }
}
```

#### Transform Image
```http
POST /images/:id/transform
Authorization: Bearer <token>
Content-Type: application/json

{
  "transformations": {
    "resize": {
      "width": "number (1-4000, optional)",
      "height": "number (1-4000, optional)",
      "fit": "string (cover|contain|fill|inside|outside, default: inside)",
      "withoutEnlargement": "boolean (default: true)"
    },
    "crop": {
      "width": "number (required)",
      "height": "number (required)",
      "x": "number (default: 0)",
      "y": "number (default: 0)"
    },
    "rotate": "number (-360 to 360)",
    "flip": "boolean",
    "mirror": "boolean",
    "filters": {
      "grayscale": "boolean",
      "sepia": "boolean",
      "blur": "number (0.3-1000)",
      "sharpen": "boolean",
      "brightness": "number (0.1-3)",
      "contrast": "number (0.1-3)",
      "saturation": "number (0-3)"
    },
    "format": "string (jpeg|jpg|png|webp|avif)",
    "formatOptions": {
      "quality": "number (1-100)",
      "progressive": "boolean",
      "compressionLevel": "number (0-9)",
      "lossless": "boolean"
    },
    "compress": {
      "quality": "number (1-100, default: 80)",
      "format": "string (optional)"
    },
    "watermark": {
      "text": "string (max 100 chars)",
      "options": {
        "gravity": "string (north|northeast|east|southeast|south|southwest|west|northwest|center, default: southeast)",
        "opacity": "number (0-1, default: 0.5)"
      }
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transformation job queued successfully",
  "data": {
    "jobId": "string",
    "originalImage": {
      "id": "string",
      "filename": "string",
      "publicUrl": "string"
    },
    "estimatedTime": "string"
  }
}
```

#### Get Image Details
```http
GET /images/:id
Authorization: Bearer <token>
```

#### Get User's Images
```http
GET /images?page=1&limit=10&format=jpeg&sortBy=createdAt&sortOrder=desc&tags=tag1,tag2
Authorization: Bearer <token>

Query Parameters:
- page: number (default: 1)
- limit: number (1-100, default: 10)
- format: string (jpeg|jpg|png|webp|gif|avif)
- sortBy: string (createdAt|updatedAt|size|downloadCount, default: createdAt)
- sortOrder: string (asc|desc, default: desc)
- tags: string (comma-separated)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "images": ["array of image objects"],
    "pagination": {
      "currentPage": "number",
      "totalPages": "number",
      "totalImages": "number",
      "hasNextPage": "boolean",
      "hasPrevPage": "boolean",
      "nextPage": "number|null",
      "prevPage": "number|null"
    },
    "storage": {
      "used": "number",
      "limit": "number",
      "available": "number",
      "count": "number"
    }
  }
}
```

#### Delete Image
```http
DELETE /images/:id
Authorization: Bearer <token>
```

#### Update Image Tags
```http
PUT /images/:id/tags
Authorization: Bearer <token>
Content-Type: application/json

{
  "tags": ["string array, max 10 tags"]
}
```

#### Update Image Visibility
```http
PUT /images/:id/visibility
Authorization: Bearer <token>
Content-Type: application/json

{
  "isPublic": "boolean"
}
```

### Jobs

#### Get Job Status
```http
GET /jobs/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "string",
      "type": "string",
      "state": "string (waiting|active|completed|failed)",
      "progress": "number (0-100)",
      "data": "object",
      "createdAt": "datetime",
      "processedOn": "datetime|null",
      "finishedOn": "datetime|null",
      "failedReason": "string|null"
    }
  }
}
```

#### Get User's Jobs
```http
GET /jobs?page=1&limit=10&state=completed
Authorization: Bearer <token>

Query Parameters:
- page: number (default: 1)
- limit: number (default: 10)
- state: string (waiting|active|completed|failed)
```

### Analytics

#### Get Dashboard Analytics
```http
GET /analytics/dashboard
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "storage": {
      "used": "number",
      "limit": "number",
      "available": "number",
      "percentage": "string",
      "imageCount": "number",
      "averageSize": "number"
    },
    "formats": ["array of format statistics"],
    "uploadTrends": ["array of daily upload data"],
    "transformations": ["array of transformation statistics"],
    "topImages": ["array of most downloaded images"]
  }
}
```

#### Get Storage Analytics
```http
GET /analytics/storage
Authorization: Bearer <token>
```

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "message": "Error description",
  "errors": ["array of validation errors (optional)"]
}
```

### HTTP Status Codes

- **200**: Success
- **201**: Created
- **202**: Accepted (for async operations)
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (invalid/missing token)
- **403**: Forbidden
- **404**: Not Found
- **429**: Too Many Requests (rate limit exceeded)
- **500**: Internal Server Error

## Example Usage

### JavaScript/Node.js
```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const API_BASE = 'http://localhost:3000/api';
let token = null;

// Register
const registerResponse = await axios.post(`${API_BASE}/auth/register`, {
  username: 'testuser',
  password: 'password123'
});
token = registerResponse.data.data.token;

// Upload image
const formData = new FormData();
formData.append('image', fs.createReadStream('image.jpg'));

const uploadResponse = await axios.post(`${API_BASE}/images`, formData, {
  headers: {
    ...formData.getHeaders(),
    Authorization: `Bearer ${token}`
  }
});

const imageId = uploadResponse.data.data.image.id;

// Transform image
const transformResponse = await axios.post(`${API_BASE}/images/${imageId}/transform`, {
  transformations: {
    resize: { width: 800, height: 600 },
    format: 'webp',
    filters: { grayscale: true }
  }
}, {
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const jobId = transformResponse.data.data.jobId;

// Check job status
const jobResponse = await axios.get(`${API_BASE}/jobs/${jobId}`, {
  headers: { Authorization: `Bearer ${token}` }
});

console.log('Job status:', jobResponse.data.data.job.state);
```

### curl Examples

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "password123"}'

# Upload image
curl -X POST http://localhost:3000/api/images \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@image.jpg"

# Transform image
curl -X POST http://localhost:3000/api/images/IMAGE_ID/transform \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transformations": {
      "resize": {"width": 800, "height": 600},
      "format": "webp"
    }
  }'

# Get images
curl -X GET "http://localhost:3000/api/images?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```
