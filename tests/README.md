# Tests

This directory contains all test suites for the UptivaLab project.

## Directory Structure

```
tests/
├── api/           # API integration tests
├── e2e/           # End-to-end tests (Playwright)
├── integration/   # Integration tests
└── debug/         # Debug and utility scripts
```

## Running Tests

### API Tests
```bash
# Run API integration tests
npm run test:api

# Or directly
node tests/api/api-test-suite.js
```

### E2E Tests
```bash
# Run end-to-end tests
npm run test:e2e
```

### All Tests
```bash
# Run all test suites
npm run test:all
```

## Prerequisites

- API server running on `http://localhost:8080`
- Database with test data
- Node.js dependencies installed
- Test credentials configured (see below)

## Configuration

Before running tests, you need to configure your test credentials:

1. Copy the example credentials file:
   ```bash
   cp test-credentials.example.json test-credentials.json
   ```

2. Edit `test-credentials.json` with your actual test credentials:
   ```json
   {
     "baseURL": "http://localhost:8080/api",
     "adminCredentials": {
       "email": "admin@uptivalab.com",
       "password": "YOUR_PASSWORD_HERE"
     },
     "testTimeout": 10000,
     "slowThreshold": 2000
   }
   ```

**Note:** The `test-credentials.json` file is excluded from git to keep your credentials secure.

## Test Scripts

- `api-test-suite.js` - Comprehensive API test suite with JWT and API key auth
- `run-tests.js` - Test runner script
- Debug scripts in `debug/` for development and troubleshooting