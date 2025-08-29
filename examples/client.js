const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
let authToken = null;

// Utility function to make authenticated requests
const apiRequest = async (method, endpoint, data = null, headers = {}) => {
  const config = {
    method,
    url: `${API_BASE_URL}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
      ...headers
    }
  };

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error ${method} ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
};

// Authentication functions
const register = async (username, password, email = null) => {
  console.log('🔐 Registering user...');
  const response = await apiRequest('POST', '/auth/register', {
    username,
    password,
    email
  });
  
  authToken = response.data.token;
  console.log('✅ User registered successfully');
  console.log('User ID:', response.data.user.id);
  return response;
};

const login = async (username, password) => {
  console.log('🔑 Logging in...');
  const response = await apiRequest('POST', '/auth/login', {
    username,
    password
  });
  
  authToken = response.data.token;
  console.log('✅ Login successful');
  console.log('User ID:', response.data.user.id);
  return response;
};

// Image functions
const uploadImage = async (imagePath) => {
  console.log('📤 Uploading image...');
  
  const formData = new FormData();
  formData.append('image', fs.createReadStream(imagePath));
  
  const config = {
    method: 'POST',
    url: `${API_BASE_URL}/images`,
    data: formData,
    headers: {
      ...formData.getHeaders(),
      Authorization: `Bearer ${authToken}`
    }
  };

  try {
    const response = await axios(config);
    console.log('✅ Image uploaded successfully');
    console.log('Image ID:', response.data.data.image.id);
    console.log('Public URL:', response.data.data.image.publicUrl);
    return response.data;
  } catch (error) {
    console.error('Upload error:', error.response?.data || error.message);
    throw error;
  }
};

const transformImage = async (imageId, transformations) => {
  console.log('🔄 Transforming image...');
  const response = await apiRequest('POST', `/images/${imageId}/transform`, {
    transformations
  });
  
  console.log('✅ Transformation job queued');
  console.log('Job ID:', response.data.jobId);
  return response;
};

const getJobStatus = async (jobId) => {
  console.log('📊 Checking job status...');
  const response = await apiRequest('GET', `/jobs/${jobId}`);
  console.log('Job Status:', response.data.job.state);
  console.log('Progress:', response.data.job.progress + '%');
  return response;
};

const getImages = async (page = 1, limit = 10) => {
  console.log('📂 Fetching images...');
  const response = await apiRequest('GET', `/images?page=${page}&limit=${limit}`);
  console.log(`✅ Found ${response.data.images.length} images`);
  return response;
};

const getImageDetails = async (imageId) => {
  console.log('🔍 Getting image details...');
  const response = await apiRequest('GET', `/images/${imageId}`);
  console.log('✅ Image details retrieved');
  console.log('Filename:', response.data.image.filename);
  console.log('Size:', response.data.image.sizeFormatted);
  console.log('Dimensions:', `${response.data.image.dimensions.width}x${response.data.image.dimensions.height}`);
  return response;
};

const getDashboard = async () => {
  console.log('📈 Getting dashboard analytics...');
  const response = await apiRequest('GET', '/analytics/dashboard');
  console.log('✅ Dashboard data retrieved');
  console.log('Storage used:', `${(response.data.storage.used / 1024 / 1024).toFixed(2)} MB`);
  console.log('Total images:', response.data.storage.imageCount);
  return response;
};

// Example usage
const runExample = async () => {
  try {
    // 1. Register or login
    await register('testuser', 'password123', 'test@example.com');
    // Or login if user already exists:
    // await login('testuser', 'password123');

    // 2. Upload an image (replace with actual image path)
    // const imagePath = './sample-image.jpg';
    // if (fs.existsSync(imagePath)) {
    //   const uploadResponse = await uploadImage(imagePath);
    //   const imageId = uploadResponse.data.image.id;

    //   // 3. Transform the image
    //   const transformResponse = await transformImage(imageId, {
    //     resize: { width: 800, height: 600 },
    //     format: 'webp',
    //     filters: { grayscale: true }
    //   });

    //   // 4. Check job status
    //   const jobId = transformResponse.data.jobId;
    //   await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    //   await getJobStatus(jobId);

    //   // 5. Get image details
    //   await getImageDetails(imageId);
    // }

    // 6. Get user's images
    await getImages();

    // 7. Get dashboard analytics
    await getDashboard();

    console.log('\n🎉 Example completed successfully!');
  } catch (error) {
    console.error('\n❌ Example failed:', error.message);
  }
};

// Advanced examples
const advancedTransformations = async (imageId) => {
  console.log('\n🎨 Running advanced transformations...');

  // Resize and compress
  await transformImage(imageId, {
    resize: { width: 1200, height: 800, fit: 'cover' },
    compress: { quality: 85 },
    format: 'webp'
  });

  // Artistic filters
  await transformImage(imageId, {
    filters: {
      sepia: true,
      brightness: 1.2,
      contrast: 1.1
    },
    format: 'jpeg'
  });

  // Complex transformation
  await transformImage(imageId, {
    crop: { width: 500, height: 500, x: 100, y: 100 },
    rotate: 90,
    filters: { grayscale: true, sharpen: true },
    format: 'png'
  });
};

// Batch operations
const batchUpload = async (imageDirectory) => {
  console.log('\n📦 Running batch upload...');
  
  const files = fs.readdirSync(imageDirectory)
    .filter(file => /\.(jpg|jpeg|png|webp|gif)$/i.test(file))
    .slice(0, 5); // Limit to 5 files for demo

  const results = [];
  for (const file of files) {
    try {
      const filePath = path.join(imageDirectory, file);
      const result = await uploadImage(filePath);
      results.push(result);
      console.log(`✅ Uploaded: ${file}`);
    } catch (error) {
      console.log(`❌ Failed to upload: ${file}`);
    }
  }

  console.log(`\n📊 Batch upload completed: ${results.length}/${files.length} successful`);
  return results;
};

// Export functions for use in other scripts
module.exports = {
  register,
  login,
  uploadImage,
  transformImage,
  getJobStatus,
  getImages,
  getImageDetails,
  getDashboard,
  advancedTransformations,
  batchUpload,
  runExample
};

// Run example if script is executed directly
if (require.main === module) {
  runExample();
}
