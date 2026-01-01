#!/usr/bin/env node

/**
 * UptivaLab API Automated Test Suite
 *
 * Comprehensive API testing with both JWT and API Key authentication
 * Follows testing best practices with proper setup, teardown, and assertions
 *
 * Usage: node api-test-suite.js
 */

import axios from 'axios';
import { expect } from 'chai';
import { describe, it, before, after, beforeEach } from 'mocha';
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
const makeRequest = async (method, url, options = {}) => {
  const { auth = 'none', data, params, headers = {} } = options;

  try {
    const response = await apiClient.request({
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
  expect(response.status).to.equal(expectedStatus, `Expected ${expectedStatus}, got ${response.status}`);
  return response;
};

const assertSuccess = (response, description) => {
  console.log(`  ${description}: ${response.status} ${response.success ? '✅' : '❌'}`);
  expect(response.success).to.be.true;
  return response;
};

const assertFailure = (response, expectedStatus, description) => {
  console.log(`  ${description}: ${response.status} ${response.success ? '✅' : '❌'}`);
  expect(response.status).to.equal(expectedStatus);
  return response;
};

// Test Suite
describe('UptivaLab API Test Suite', function() {
  this.timeout(CONFIG.testTimeout);
  this.slow(CONFIG.slowThreshold);

  before(async function() {
    console.log('🚀 Starting UptivaLab API Test Suite');
    console.log(`📍 Base URL: ${CONFIG.baseURL}`);
    console.log(`⏱️  Timeout: ${CONFIG.testTimeout}ms`);
    console.log('');

    // Health check
    const healthResponse = await makeRequest('GET', '/health');
    if (!healthResponse.success) {
      throw new Error('API is not healthy. Aborting tests.');
    }
    console.log('✅ API Health Check Passed');
  });

  after(function() {
    console.log('');
    console.log('🏁 Test Suite Completed');
  });

  // Authentication Tests
  describe('🔐 Authentication', function() {

    it('should check setup status', async function() {
      const response = await makeRequest('GET', '/auth/setup-needed');
      assertSuccess(response, 'Setup status check');
      expect(response.data).to.have.property('setupNeeded');
    });

    it('should reject setup when already completed', async function() {
      const response = await makeRequest('POST', '/auth/setup', {
        data: { email: 'test@example.com', password: 'TestPass123!' }
      });
      assertFailure(response, 403, 'Setup rejection');
    });

    it('should login successfully', async function() {
      const response = await makeRequest('POST', '/auth/login', {
        data: CONFIG.adminCredentials
      });
      assertSuccess(response, 'User login');
      expect(response.data).to.have.property('token');
      expect(response.data).to.have.property('user');
      jwtToken = response.data.token;
      console.log('  📝 JWT Token acquired');
    });

    it('should reject invalid login', async function() {
      const response = await makeRequest('POST', '/auth/login', {
        data: { email: 'invalid@example.com', password: 'wrongpass' }
      });
      assertFailure(response, 401, 'Invalid login rejection');
    });

    it('should reject registration', async function() {
      const response = await makeRequest('POST', '/auth/register', {
        data: { email: 'newuser@example.com', password: 'NewPass123!' }
      });
      assertFailure(response, 403, 'Registration rejection');
    });

  });

  // API Key Management Tests
  describe('🔑 API Key Management', function() {

    it('should create API key with JWT', async function() {
      const response = await makeRequest('POST', '/settings/api-keys', {
        auth: 'jwt',
        data: { label: 'Test API Key' }
      });
      assertSuccess(response, 'API key creation');
      expect(response.data).to.have.property('token');
      expect(response.data).to.have.property('id');
      apiKey = response.data.token;
      console.log('  📝 API Key acquired');
    });

    it('should list API keys with JWT', async function() {
      const response = await makeRequest('GET', '/settings/api-keys', {
        auth: 'jwt'
      });
      assertSuccess(response, 'API keys listing');
      expect(response.data).to.be.an('array');
    });

    it('should reject API key creation without JWT', async function() {
      const response = await makeRequest('POST', '/settings/api-keys', {
        data: { label: 'Unauthorized Key' }
      });
      assertFailure(response, 401, 'Unauthorized API key creation');
    });

  });

  // User Management Tests
  describe('👥 User Management', function() {

    it('should list users with JWT', async function() {
      const response = await makeRequest('GET', '/users', {
        auth: 'jwt'
      });
      assertSuccess(response, 'Users listing');
      expect(response.data).to.be.an('array');
      expect(response.data.length).to.be.greaterThan(0);
    });

    it('should create new user with JWT', async function() {
      const response = await makeRequest('POST', '/users', {
        auth: 'jwt',
        data: {
          email: `testuser_${Date.now()}@example.com`,
          password: 'TestPass123!',
          role: 'VIEWER'
        }
      });
      assertSuccess(response, 'User creation');
      expect(response.data).to.have.property('id');
      testUserId = response.data.id;
    });

    it('should update user role with JWT', async function() {
      const response = await makeRequest('PUT', `/users/${testUserId}/role`, {
        auth: 'jwt',
        data: { role: 'ADMIN' }
      });
      assertSuccess(response, 'User role update');
    });

    it('should delete user with JWT', async function() {
      const response = await makeRequest('DELETE', `/users/${testUserId}`, {
        auth: 'jwt'
      });
      assertSuccess(response, 'User deletion');
    });

    it('should reject user operations without JWT', async function() {
      const responses = await Promise.all([
        makeRequest('GET', '/users'),
        makeRequest('POST', '/users', { data: { email: 'test@example.com', password: 'pass', role: 'VIEWER' } })
      ]);

      responses.forEach((response, index) => {
        assertFailure(response, 401, `Unauthorized user operation ${index + 1}`);
      });
    });

  });

  // Invitation Management Tests
  describe('📨 Invitation Management', function() {

    it('should create invitation with JWT', async function() {
      const response = await makeRequest('POST', '/invitations', {
        auth: 'jwt',
        data: {
          email: `invite_${Date.now()}@example.com`,
          role: 'VIEWER'
        }
      });
      assertSuccess(response, 'Invitation creation');
      expect(response.data).to.have.property('token');
      testInvitationId = response.data.id;
    });

    it('should list invitations with JWT', async function() {
      const response = await makeRequest('GET', '/invitations', {
        auth: 'jwt'
      });
      assertSuccess(response, 'Invitations listing');
      expect(response.data).to.be.an('array');
    });

    it('should verify invitation token without auth', async function() {
      // First get the token from the created invitation
      const listResponse = await makeRequest('GET', '/invitations', { auth: 'jwt' });
      const invitation = listResponse.data.find(inv => inv.id === testInvitationId);
      expect(invitation).to.exist;

      const response = await makeRequest('GET', `/invitations/verify/${invitation.token}`);
      assertSuccess(response, 'Invitation verification');
    });

    it('should delete invitation with JWT', async function() {
      const response = await makeRequest('DELETE', `/invitations/${testInvitationId}`, {
        auth: 'jwt'
      });
      assertSuccess(response, 'Invitation deletion');
    });

  });

  // Monitor Tests
  describe('📊 Monitors', function() {

    it('should list monitors with API key', async function() {
      const response = await makeRequest('GET', '/monitors', {
        auth: 'apiKey'
      });
      assertSuccess(response, 'Monitors listing with API key');
      expect(response.data).to.be.an('array');
      expect(response.data.length).to.be.greaterThan(0);
      testMonitorId = response.data[0].id;
    });

    it('should list monitors with JWT', async function() {
      const response = await makeRequest('GET', '/monitors', {
        auth: 'jwt'
      });
      assertSuccess(response, 'Monitors listing with JWT');
      expect(response.data).to.be.an('array');
    });

    it('should get monitor details with JWT', async function() {
      const response = await makeRequest('GET', `/monitors/${testMonitorId}`, {
        auth: 'jwt'
      });
      assertSuccess(response, 'Monitor details retrieval');
      expect(response.data).to.have.property('id', testMonitorId);
    });

    it('should get monitor history with JWT', async function() {
      const response = await makeRequest('GET', `/monitors/${testMonitorId}/history`, {
        auth: 'jwt'
      });
      assertSuccess(response, 'Monitor history retrieval');
      expect(response.data).to.be.an('array');
    });

    it('should get monitor uptime with JWT', async function() {
      const response = await makeRequest('GET', `/monitors/${testMonitorId}/uptime`, {
        auth: 'jwt'
      });
      assertSuccess(response, 'Monitor uptime retrieval');
    });

    it('should reject monitor operations without proper auth', async function() {
      const responses = await Promise.all([
        makeRequest('GET', `/monitors/${testMonitorId}`), // No auth
        makeRequest('POST', '/monitors', { data: { name: 'Test Monitor', kind: 'http', target: 'https://example.com' } }), // No auth
        makeRequest('GET', `/monitors/${testMonitorId}`, { auth: 'apiKey' }), // API key for JWT endpoint
      ]);

      assertFailure(responses[0], 401, 'Unauthorized monitor access');
      assertFailure(responses[1], 401, 'Unauthorized monitor creation');
      assertFailure(responses[2], 401, 'API key rejected for JWT endpoint');
    });

  });

  // Status Tests
  describe('📈 Status', function() {

    it('should get status with API key', async function() {
      const response = await makeRequest('GET', '/status', {
        auth: 'apiKey'
      });
      assertSuccess(response, 'Status retrieval with API key');
      expect(response.data).to.be.an('array');
    });

    it('should get status list with JWT', async function() {
      const response = await makeRequest('GET', '/status/list', {
        auth: 'jwt'
      });
      assertSuccess(response, 'Status list with JWT');
      expect(response.data).to.be.an('array');
    });

    it('should get public status without auth', async function() {
      const response = await makeRequest('GET', '/status/public/test-slug');
      assertResponse(response, 404, 'Public status page (expected 404 for non-existent slug)');
    });

    it('should reject status operations without proper auth', async function() {
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
  describe('💓 Heartbeats', function() {

    it('should accept heartbeat without auth', async function() {
      const response = await makeRequest('POST', '/heartbeat/test-token', {
        data: { status: 'up', message: 'Test heartbeat' }
      });
      assertSuccess(response, 'Heartbeat acceptance');
    });

    it('should list heartbeats with JWT', async function() {
      const response = await makeRequest('GET', '/heartbeats', {
        auth: 'jwt'
      });
      assertSuccess(response, 'Heartbeats listing');
      expect(response.data).to.be.an('array');
    });

    it('should reject heartbeat operations without JWT', async function() {
      const response = await makeRequest('GET', '/heartbeats');
      assertFailure(response, 401, 'Unauthorized heartbeats access');
    });

  });

  // Incident Tests
  describe('🚨 Incidents', function() {

    it('should list incidents with JWT', async function() {
      const response = await makeRequest('GET', '/incidents', {
        auth: 'jwt'
      });
      assertSuccess(response, 'Incidents listing');
      expect(response.data).to.be.an('array');
    });

    it('should list incidents (simple) with JWT', async function() {
      const response = await makeRequest('GET', '/incidents/list', {
        auth: 'jwt'
      });
      assertSuccess(response, 'Incidents simple listing');
      expect(response.data).to.be.an('array');
    });

    it('should reject incident operations without JWT', async function() {
      const responses = await Promise.all([
        makeRequest('GET', '/incidents'),
        makeRequest('GET', '/incidents/list')
      ]);

      responses.forEach((response, index) => {
        assertFailure(response, 401, `Unauthorized incidents access ${index + 1}`);
      });
    });

  });

  // Maintenance Tests
  describe('🔧 Maintenance', function() {

    it('should list maintenance windows with JWT', async function() {
      const response = await makeRequest('GET', '/maintenance', {
        auth: 'jwt'
      });
      assertSuccess(response, 'Maintenance windows listing');
      expect(response.data).to.be.an('array');
    });

    it('should create maintenance window with JWT', async function() {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 3600000); // 1 hour later

      const response = await makeRequest('POST', '/maintenance', {
        auth: 'jwt',
        data: {
          name: 'Test Maintenance',
          description: 'Automated test maintenance window',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          monitorIds: [testMonitorId]
        }
      });
      assertSuccess(response, 'Maintenance window creation');
      expect(response.data).to.have.property('id');
      testMaintenanceId = response.data.id;
    });

    it('should reject maintenance operations without JWT', async function() {
      const response = await makeRequest('GET', '/maintenance');
      assertFailure(response, 401, 'Unauthorized maintenance access');
    });

  });

  // Notification Tests
  describe('📢 Notifications', function() {

    it('should list notifications with JWT', async function() {
      const response = await makeRequest('GET', '/notifications', {
        auth: 'jwt'
      });
      assertSuccess(response, 'Notifications listing');
      expect(response.data).to.be.an('array');
      if (response.data.length > 0) {
        testNotificationId = response.data[0].id;
      }
    });

    it('should create notification channel with JWT', async function() {
      const response = await makeRequest('POST', '/notifications', {
        auth: 'jwt',
        data: {
          name: 'Test Notification',
          type: 'ntfy',
          config: { topic: 'test-topic' }
        }
      });
      assertSuccess(response, 'Notification channel creation');
      expect(response.data).to.have.property('id');
      testNotificationId = response.data.id;
    });

    it('should test notification channel with JWT', async function() {
      const response = await makeRequest('POST', '/notifications/test', {
        auth: 'jwt',
        data: { id: testNotificationId }
      });
      // Test endpoint might return various status codes depending on external service
      expect([200, 400, 500]).to.include(response.status);
    });

    it('should reject notification operations without JWT', async function() {
      const response = await makeRequest('GET', '/notifications');
      assertFailure(response, 401, 'Unauthorized notifications access');
    });

  });

  // Status Page Tests
  describe('📄 Status Pages', function() {

    it('should list status pages with JWT', async function() {
      const response = await makeRequest('GET', '/status-pages', {
        auth: 'jwt'
      });
      assertSuccess(response, 'Status pages listing');
      expect(response.data).to.be.an('array');
    });

    it('should create status page with JWT', async function() {
      const response = await makeRequest('POST', '/status-pages', {
        auth: 'jwt',
        data: {
          name: 'Test Status Page',
          slug: `test-page-${Date.now()}`,
          description: 'Automated test status page',
          monitorIds: [testMonitorId]
        }
      });
      assertSuccess(response, 'Status page creation');
      expect(response.data).to.have.property('id');
      testStatusPageId = response.data.id;
    });

    it('should get status page details with JWT', async function() {
      const response = await makeRequest('GET', `/status-pages/${testStatusPageId}`, {
        auth: 'jwt'
      });
      assertSuccess(response, 'Status page details');
    });

    it('should update status page with JWT', async function() {
      const response = await makeRequest('PUT', `/status-pages/${testStatusPageId}`, {
        auth: 'jwt',
        data: {
          name: 'Updated Test Status Page',
          description: 'Updated automated test status page'
        }
      });
      assertSuccess(response, 'Status page update');
    });

    it('should delete status page with JWT', async function() {
      const response = await makeRequest('DELETE', `/status-pages/${testStatusPageId}`, {
        auth: 'jwt'
      });
      assertSuccess(response, 'Status page deletion');
    });

    it('should reject status page operations without JWT', async function() {
      const response = await makeRequest('GET', '/status-pages');
      assertFailure(response, 401, 'Unauthorized status pages access');
    });

  });

  // Settings Tests
  describe('⚙️ Settings', function() {

    it('should get settings with JWT', async function() {
      const response = await makeRequest('GET', '/settings', {
        auth: 'jwt'
      });
      assertSuccess(response, 'Settings retrieval');
      expect(response.data).to.be.an('object');
    });

    it('should reject settings operations without JWT', async function() {
      const response = await makeRequest('GET', '/settings');
      assertFailure(response, 401, 'Unauthorized settings access');
    });

  });

  // Recorder Tests
  describe('🎬 Recorder', function() {

    it('should generate code with JWT', async function() {
      const response = await makeRequest('POST', '/recorder/codegen', {
        auth: 'jwt',
        data: {
          html: '<button>Click me</button>',
          actions: [{ type: 'click', selector: 'button' }]
        }
      });
      assertSuccess(response, 'Code generation');
    });

    it('should parse HTML with JWT', async function() {
      const response = await makeRequest('POST', '/recorder/parse', {
        auth: 'jwt',
        data: { html: '<div><span>Hello</span></div>' }
      });
      assertSuccess(response, 'HTML parsing');
    });

    it('should reject recorder operations without JWT', async function() {
      const response = await makeRequest('POST', '/recorder/codegen', {
        data: { html: '<button>Test</button>' }
      });
      assertFailure(response, 401, 'Unauthorized recorder access');
    });

  });

  // Cloudflare Tunnel Tests
  describe('🌐 Cloudflare Tunnel', function() {

    it('should get tunnel status with JWT', async function() {
      const response = await makeRequest('GET', '/cloudflare-tunnel/status', {
        auth: 'jwt'
      });
      // Status endpoint might return various codes depending on tunnel state
      expect([200, 404, 500]).to.include(response.status);
    });

    it('should reject tunnel operations without JWT', async function() {
      const response = await makeRequest('GET', '/cloudflare-tunnel/status');
      assertFailure(response, 401, 'Unauthorized tunnel access');
    });

  });

  // Public/Utility Tests
  describe('🌐 Public/Utilities', function() {

    it('should get health status without auth', async function() {
      const response = await makeRequest('GET', '/health');
      assertSuccess(response, 'Health check');
      expect(response.data).to.have.property('status', 'ok');
    });

    it('should get robots.txt without auth', async function() {
      const response = await makeRequest('GET', '/robots.txt');
      assertSuccess(response, 'Robots.txt retrieval');
      expect(response.data).to.include('User-agent: *');
    });

  });

  // Cleanup Tests
  describe('🧹 Cleanup', function() {

    it('should clean up test data', async function() {
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

});