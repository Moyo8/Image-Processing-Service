const request = require('supertest');
const app = require('../src/server');
const User = require('../src/models/User');
const mongoose = require('mongoose');

describe('Authentication Endpoints', () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/image-processing-test');
  });

  afterAll(async () => {
    // Clean up and close database connection
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up users before each test
    await User.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    const validUser = {
      username: 'testuser',
      password: 'password123'
    };

    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe(validUser.username);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should not register user with invalid data', async () => {
      const invalidUser = {
        username: 'ab', // too short
        password: '123' // too short
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should not register user with existing username', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(validUser)
        .expect(201);

      // Second registration with same username
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUser)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    const userData = {
      username: 'testuser',
      password: 'password123'
    };

    beforeEach(async () => {
      // Register user before each login test
      await request(app)
        .post('/api/auth/register')
        .send(userData);
    });

    it('should login user with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(userData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.token).toBeDefined();
    });

    it('should not login user with invalid credentials', async () => {
      const invalidCredentials = {
        username: userData.username,
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidCredentials)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should not login non-existent user', async () => {
      const nonExistentUser = {
        username: 'nonexistent',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(nonExistentUser)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken;
    let userId;

    beforeEach(async () => {
      const userData = {
        username: 'testuser',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      authToken = response.body.data.token;
      userId = response.body.data.user.id;
    });

    it('should get current user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(userId);
      expect(response.body.data.user.username).toBe('testuser');
    });

    it('should not get profile without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No token provided');
    });

    it('should not get profile with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid token.');
    });
  });
});
