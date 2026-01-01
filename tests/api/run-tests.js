#!/usr/bin/env node

/**
 * UptivaLab API Test Runner
 *
 * Runs the comprehensive API test suite using Mocha
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testFile = path.join(__dirname, 'api-test-suite.js');

console.log('🚀 Starting UptivaLab API Test Suite');
console.log(`📁 Test file: ${testFile}`);
console.log('');

// Run Mocha with the test file
const mocha = spawn('npx', ['mocha', testFile, '--timeout', '15000', '--slow', '2000'], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '../..') // Go back to project root
});

mocha.on('close', (code) => {
  console.log('');
  if (code === 0) {
    console.log('✅ All tests passed!');
  } else {
    console.log(`❌ Tests failed with exit code ${code}`);
  }
  process.exit(code);
});

mocha.on('error', (error) => {
  console.error('❌ Failed to start test runner:', error);
  process.exit(1);
});