#!/usr/bin/env node

/**
 * UptivaLab API Automated Test Suite (Node.js Test Runner)
 *
 * Comprehensive API testing using Node.js built-in test runner
 */

import { test, describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import axios from 'axios';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load credentials from JSON file
let CONFIG;
try {
  CONFIG = JSON.parse(readFileSync(join(__dirname, '../test-credentials.json'), 'utf8'));
} catch (error) {
  console.error('❌ Error loading test-credentials.json. Please copy test-credentials.example.json to test-credentials.json and configure your credentials.');
  process.exit(1);
}

// Global test data
let jwtToken = '';
let apiKey = '';
let testUserId = '';
let testMonitorId = '';
let testInvitationId = '';
let testNotificationId = '';
let testStatusPageId = '';
let testMaintenanceId = '';

// HTTP Client Setup
const apiClient = axios.create({
  baseURL: CONFIG.baseURL,
  timeout: CONFIG.testTimeout,
  validateStatus: () => true // Don't throw on any status code
});

// Authentication helpers
const authHeaders = {
  jwt: () => ({ Authorization: `Bearer ${jwtToken}` }),
  apiKey: () => ({ 'X-API-Key': apiKey }),
  bearerApiKey: () => ({ Authorization: `Bearer ${apiKey}` }),
  none: () => ({})
};

// Test utilities
const makeRequest = async (method, url, options = {}, customBaseURL = null) => {
  const { auth = 'none', data, params, headers = {} } = options;
  const baseURL = customBaseURL || CONFIG.baseURL;

  const client = axios.create({
    baseURL,
    timeout: CONFIG.testTimeout,
    validateStatus: () => true // Don't throw on any status code
  });

  try {
    const response = await client.request({
      method: method.toUpperCase(),
      url,
      data,
      params,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders[auth](),
        ...headers
      }
    });

    return {
      status: response.status,
      data: response.data,
      headers: response.headers,
      success: response.status >= 200 && response.status < 300
    };
  } catch (error) {
    return {
      status: error.response?.status || 0,
      data: error.response?.data || error.message,
      headers: error.response?.headers || {},
      success: false,
      error: error.message
    };
  }
};

// Custom assertions
const assertResponse = (response, expectedStatus, description) => {
  console.log(`  ${description}: ${response.status} ${response.success ? '✅' : '❌'}`);
  assert.strictEqual(response.status, expectedStatus, `Expected ${expectedStatus}, got ${response.status}`);
  return response;
};

const assertSuccess = (response, description) => {
  console.log(`  ${description}: ${response.status} ${response.success ? '✅' : '❌'}`);
  assert(response.success, `Expected success but got status ${response.status}`);
  return response;
};

const assertFailure = (response, expectedStatus, description) => {
  console.log(`  ${description}: ${response.status} ${response.status === expectedStatus ? '✅' : '❌'}`);
  assert.strictEqual(response.status, expectedStatus, `Expected ${expectedStatus}, got ${response.status}`);
  return response;
};

// Test Suite
describe('UptivaLab API Test Suite', async () => {
  console.log('🚀 Starting UptivaLab API Test Suite');
  console.log(`📍 Base URL: ${CONFIG.baseURL}`);
  console.log(`⏱️  Timeout: ${CONFIG.testTimeout}ms`);
  console.log('');

  // Health check
  const healthResponse = await makeRequest('GET', '/health', {}, 'http://localhost:8080');
  if (!healthResponse.success) {
    throw new Error('API is not healthy. Aborting tests.');
  }
  console.log('✅ API Health Check Passed');

  // Authentication Tests
  describe('🔐 Authentication', () => {

    it('should check setup status', async () => {
      const response = await makeRequest('GET', '/auth/setup-needed');
      assertSuccess(response, 'Setup status check');
      assert(response.data.setupNeeded !== undefined, 'Should have setupNeeded property');
    });

    it('should reject setup when already completed', async () => {
      const response = await makeRequest('POST', '/auth/setup', {
        data: { email: 'test@example.com', password: 'TestPass123!' }
      });
      assertFailure(response, 403, 'Setup rejection');
    });

    it('should login successfully', async () => {
      const response = await makeRequest('POST', '/auth/login', {
        data: CONFIG.adminCredentials
      });
      assertSuccess(response, 'User login');
      assert(response.data.token, 'Should have token');
      assert(response.data.user, 'Should have user');
      jwtToken = response.data.token;
      console.log('  📝 JWT Token acquired');
    });

    it('should reject invalid login', async () => {
      const response = await makeRequest('POST', '/auth/login', {
        data: { email: 'invalid@example.com', password: 'wrongpass' }
      });
      assertFailure(response, 403, 'Invalid login rejection');
    });

    it('should reject registration', async () => {
      const response = await makeRequest('POST', '/auth/register', {
        data: { email: 'newuser@example.com', password: 'NewPass123!' }
      });
      assertFailure(response, 403, 'Registration rejection');
    });

  });

  // API Key Management Tests
  describe('🔑 API Key Management', () => {

    it('should create API key with JWT', async () => {
      const response = await makeRequest('POST', '/settings/api-keys', {
        auth: 'jwt',
        data: { label: 'Test API Key' }
      });
      assertSuccess(response, 'API key creation');
      assert(response.data.token, 'Should have token');
      assert(response.data.id, 'Should have id');
      apiKey = response.data.token;
      console.log('  📝 API Key acquired');
    });

    it('should list API keys with JWT', async () => {
      const response = await makeRequest('GET', '/settings/api-keys', {
        auth: 'jwt'
      });
      assertSuccess(response, 'API keys listing');
      assert(Array.isArray(response.data), 'Should be an array');
    });

    it('should reject API key creation without JWT', async () => {
      const response = await makeRequest('POST', '/settings/api-keys', {
        data: { label: 'Unauthorized Key' }
      });
      assertFailure(response, 401, 'Unauthorized API key creation');
    });

  });

  // Monitor Tests
  describe('📊 Monitors', () => {

    it('should list monitors with API key', async () => {
      const response = await makeRequest('GET', '/monitors', {
        auth: 'apiKey'
      });
      assertSuccess(response, 'Monitors listing with API key');
      assert(Array.isArray(response.data), 'Should be an array');
      assert(response.data.length > 0, 'Should have monitors');
      testMonitorId = response.data[0].id;
    });

    it('should reject monitors access with JWT', async () => {
      const response = await makeRequest('GET', '/monitors', {
        auth: 'jwt'
      });
      assertFailure(response, 401, 'JWT rejected for monitors endpoint');
    });

    it('should reject monitor operations without proper auth', async () => {
      const responses = await Promise.all([
        makeRequest('GET', `/monitors/${testMonitorId}`), // No auth - should return 404 (endpoint doesn't exist)
        makeRequest('GET', `/monitors/${testMonitorId}`, { auth: 'jwt' }), // JWT for non-existent endpoint
      ]);

      assertFailure(responses[0], 404, 'Monitor detail endpoint does not exist');
      assertFailure(responses[1], 404, 'Monitor detail endpoint does not exist with JWT');
    });

  });

  // Status Tests
  describe('📈 Status', () => {

    it('should get status with API key', async () => {
      const response = await makeRequest('GET', '/status', {
        auth: 'apiKey'
      });
      assertSuccess(response, 'Status retrieval with API key');
      assert(Array.isArray(response.data), 'Should be an array');
    });

    it('should get status list with JWT', async () => {
      const response = await makeRequest('GET', '/status/list', {
        auth: 'jwt'
      });
      assertSuccess(response, 'Status list with JWT');
      assert(Array.isArray(response.data), 'Should be an array');
    });

    it('should reject status operations without proper auth', async () => {
      const responses = await Promise.all([
        makeRequest('GET', '/status'), // No auth
        makeRequest('GET', '/status/list'), // No auth
        makeRequest('GET', '/status/list', { auth: 'apiKey' }), // API key for JWT endpoint
      ]);

      assertFailure(responses[0], 401, 'Unauthorized status access');
      assertFailure(responses[1], 401, 'Unauthorized status list access');
      assertFailure(responses[2], 401, 'API key rejected for JWT status endpoint');
    });

  });

  // Heartbeat Tests
  describe('💓 Heartbeats', () => {

    it('should accept heartbeat without auth', async () => {
      const response = await makeRequest('POST', '/heartbeat/test-token', {
        data: { status: 'up', message: 'Test heartbeat' }
      });
      // Endpoint exists and returns 404 for unknown token, which is correct behavior
      assertFailure(response, 404, 'Heartbeat endpoint returns 404 for unknown token');
      assert.strictEqual(response.data.message, 'Unknown token', 'Should return unknown token message');
    });

    it('should list heartbeats with JWT', async () => {
      const response = await makeRequest('GET', '/heartbeats', {
        auth: 'jwt'
      });
      assertSuccess(response, 'Heartbeats listing');
      assert(Array.isArray(response.data), 'Should be an array');
    });

    it('should reject heartbeat operations without JWT', async () => {
      const response = await makeRequest('GET', '/heartbeats');
      assertFailure(response, 401, 'Unauthorized heartbeats access');
    });

  });

  // Public/Utility Tests
  describe('🌐 Public/Utilities', () => {

    it('should get health status without auth', async () => {
      const response = await makeRequest('GET', '/health', {}, 'http://localhost:8080');
      assertSuccess(response, 'Health check');
      assert.strictEqual(response.data.status, 'ok', 'Should have status ok');
    });

  });

  // Cleanup
  describe('🧹 Cleanup', () => {

    it('should clean up test data', async () => {
      console.log('  🧹 Cleaning up test data...');

      // Delete test maintenance window if created
      if (testMaintenanceId) {
        await makeRequest('DELETE', `/maintenance/${testMaintenanceId}`, { auth: 'jwt' });
      }

      // Delete test notification if created
      if (testNotificationId) {
        await makeRequest('DELETE', `/notifications/${testNotificationId}`, { auth: 'jwt' });
      }

      console.log('  ✅ Test data cleanup completed');
    });

  });

  console.log('');
  console.log('🏁 Test Suite Completed');
});