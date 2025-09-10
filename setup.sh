#!/bin/bash

# Image Processing Service Setup Script
echo "🚀 Setting up Image Processing Service..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please update the .env file with your configuration before starting the server."
fi

# Create logs directory
mkdir -p logs


   
    
else
    echo "📝 Manual setup instructions:"
    echo "1. Install and start MongoDB on localhost:27017"
    echo "2. Install and start Redis on localhost:6379"
    echo "3. Configure AWS S3 credentials in .env file"


# Run tests
echo "🧪 Running tests..."
npm test

if [ $? -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "⚠️  Some tests failed. Please check the configuration."
fi

echo ""
echo "🎉 Setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Update your .env file with proper credentials"
echo "2. Start the development server: npm run dev"
echo "3. Visit http://localhost:3000/health to check if the server is running"
echo ""
echo "📚 API Documentation:"
echo "- Health Check: GET /health"
echo "- Register: POST /api/auth/register"
echo "- Login: POST /api/auth/login"
echo "- Upload Image: POST /api/images"
echo "- Transform Image: POST /api/images/:id/transform"
echo "- Get Images: GET /api/images"
echo ""
echo "💡 Example client usage: node examples/client.js"