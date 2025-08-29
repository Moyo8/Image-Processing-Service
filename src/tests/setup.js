require('dotenv').config({ path: '.env.test' });

// Increase timeout for database operations
jest.setTimeout(30000);

// Mock console.log in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
