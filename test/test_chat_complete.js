const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

class AIServiceTester {
  constructor() {
    this.aiProcess = null;
    this.servicePort = 8003; // Use a different port to avoid conflicts
    this.testResults = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async startAIService() {
    return new Promise((resolve, reject) => {
      this.log('Starting AI service for testing...');
      
      const venvPython = path.join(__dirname, 'AI_agent', 'ai_env', 'Scripts', 'python.exe');
      const servicePath = path.join(__dirname, 'AI_agent', 'start_service.py');
      const dbPath = path.join(__dirname, 'test_database.db');
      
      this.aiProcess = spawn(venvPython, [
        servicePath,
        dbPath,
        '', // No API key for basic testing
        this.servicePort.toString()
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          FOCUSBOOK_DB_PATH: dbPath
        }
      });

      let startupOutput = '';
      let errorOutput = '';

      this.aiProcess.stdout.on('data', (data) => {
        const output = data.toString();
        startupOutput += output;
        console.log('AI Service:', output.trim());
        
        if (output.includes('Application startup complete')) {
          this.log('AI service started successfully', 'success');
          setTimeout(() => resolve(), 2000); // Wait a bit more for full startup
        }
      });

      this.aiProcess.stderr.on('data', (data) => {
        const output = data.toString();
        errorOutput += output;
        console.log('AI Service Log:', output.trim());
        
        // Check for startup completion in stderr as well (where uvicorn logs go)
        if (output.includes('Application startup complete')) {
          this.log('AI service started successfully', 'success');
          setTimeout(() => resolve(), 2000); // Wait a bit more for full startup
        }
      });

      this.aiProcess.on('error', (error) => {
        this.log(`Failed to start AI service: ${error.message}`, 'error');
        reject(error);
      });

      this.aiProcess.on('exit', (code, signal) => {
        if (code !== 0 && code !== null) {
          this.log(`AI service exited with code ${code}`, 'error');
          reject(new Error(`Service exited with code ${code}`));
        }
      });

      // Timeout after 15 seconds
      setTimeout(() => {
        if (!startupOutput.includes('Application startup complete')) {
          this.log('Service startup timeout', 'error');
          reject(new Error('Service startup timeout'));
        }
      }, 15000);
    });
  }

  async stopAIService() {
    if (this.aiProcess && !this.aiProcess.killed) {
      this.log('Stopping AI service...');
      this.aiProcess.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (!this.aiProcess.killed) {
          this.aiProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  }

  async testHealthEndpoint() {
    return new Promise((resolve) => {
      this.log('Testing health endpoint (/docs)...');
      
      const req = http.request({
        hostname: '127.0.0.1',
        port: this.servicePort,
        path: '/docs',
        method: 'GET',
        timeout: 5000
      }, (res) => {
        const success = res.statusCode === 200;
        this.testResults.push({
          test: 'Health Endpoint',
          status: success ? 'PASS' : 'FAIL',
          details: `Status Code: ${res.statusCode}`
        });
        this.log(`Health endpoint test: ${success ? 'PASS' : 'FAIL'} (${res.statusCode})`, success ? 'success' : 'error');
        resolve(success);
      });

      req.on('error', (err) => {
        this.testResults.push({
          test: 'Health Endpoint',
          status: 'FAIL',
          details: err.message
        });
        this.log(`Health endpoint test: FAIL - ${err.message}`, 'error');
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        this.testResults.push({
          test: 'Health Endpoint',
          status: 'FAIL',
          details: 'Request timeout'
        });
        this.log('Health endpoint test: FAIL - Timeout', 'error');
        resolve(false);
      });

      req.end();
    });
  }

  async testChatEndpoint(message, testName) {
    return new Promise((resolve) => {
      this.log(`Testing chat endpoint: ${testName}...`);
      
      const data = JSON.stringify({ message });

      const req = http.request({
        hostname: '127.0.0.1',
        port: this.servicePort,
        path: '/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        },
        timeout: 30000 // 30 second timeout for AI responses
      }, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              this.testResults.push({
                test: testName,
                status: 'FAIL',
                details: `HTTP ${res.statusCode}: ${responseData}`
              });
              this.log(`${testName}: FAIL - HTTP ${res.statusCode}`, 'error');
              resolve({ success: false, error: `HTTP ${res.statusCode}` });
              return;
            }

            const jsonResponse = JSON.parse(responseData);
            
            if (jsonResponse.error) {
              this.testResults.push({
                test: testName,
                status: 'FAIL',
                details: jsonResponse.error
              });
              this.log(`${testName}: FAIL - ${jsonResponse.error}`, 'error');
              resolve({ success: false, error: jsonResponse.error });
            } else if (jsonResponse.reply) {
              this.testResults.push({
                test: testName,
                status: 'PASS',
                details: `Response received: ${jsonResponse.reply.substring(0, 100)}...`
              });
              this.log(`${testName}: PASS`, 'success');
              this.log(`Response: ${jsonResponse.reply.substring(0, 200)}...`);
              resolve({ success: true, response: jsonResponse.reply });
            } else {
              this.testResults.push({
                test: testName,
                status: 'FAIL',
                details: 'No reply field in response'
              });
              this.log(`${testName}: FAIL - No reply field`, 'error');
              resolve({ success: false, error: 'No reply field' });
            }
          } catch (error) {
            this.testResults.push({
              test: testName,
              status: 'FAIL',
              details: `JSON parse error: ${error.message}`
            });
            this.log(`${testName}: FAIL - JSON parse error`, 'error');
            resolve({ success: false, error: error.message });
          }
        });
      });

      req.on('error', (err) => {
        this.testResults.push({
          test: testName,
          status: 'FAIL',
          details: err.message
        });
        this.log(`${testName}: FAIL - ${err.message}`, 'error');
        resolve({ success: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        this.testResults.push({
          test: testName,
          status: 'FAIL',
          details: 'Request timeout'
        });
        this.log(`${testName}: FAIL - Timeout`, 'error');
        resolve({ success: false, error: 'Timeout' });
      });

      req.write(data);
      req.end();
    });
  }

  async runAllTests() {
    this.log('🚀 Starting AI Service Chat Tests', 'info');
    
    try {
      // Start the AI service
      await this.startAIService();
      
      // Wait a bit for service to be fully ready
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Test 1: Health endpoint
      await this.testHealthEndpoint();
      
      // Test 2: Basic greeting
      await this.testChatEndpoint(
        'Hello! Can you help me understand my productivity patterns?',
        'Basic Greeting Test'
      );
      
      // Test 3: Database query (without actual data)
      await this.testChatEndpoint(
        'Show me my app usage for today',
        'Database Query Test'
      );
      
      // Test 4: Productivity analysis
      await this.testChatEndpoint(
        'What are my most productive hours?',
        'Productivity Analysis Test'
      );
      
      // Test 5: Category insights
      await this.testChatEndpoint(
        'Which apps do I spend the most time on?',
        'Category Insights Test'
      );

    } catch (error) {
      this.log(`Test setup failed: ${error.message}`, 'error');
    } finally {
      // Always stop the service
      await this.stopAIService();
    }

    // Print test results
    this.printTestResults();
  }

  printTestResults() {
    this.log('📊 Test Results Summary:', 'info');
    console.log('═'.repeat(80));
    
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    
    this.testResults.forEach(result => {
      const status = result.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} | ${result.test}`);
      if (result.details) {
        console.log(`     Details: ${result.details}`);
      }
    });
    
    console.log('═'.repeat(80));
    console.log(`📊 Total Tests: ${this.testResults.length} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    
    if (failed === 0) {
      this.log('🎉 All tests passed! AI service is working correctly.', 'success');
    } else {
      this.log(`⚠️ ${failed} test(s) failed. Please check the configuration.`, 'error');
    }
  }
}

// Run the tests
const tester = new AIServiceTester();
tester.runAllTests().catch(console.error);

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  tester.stopAIService().then(() => {
    process.exit(0);
  });
});

process.on('exit', () => {
  tester.stopAIService();
});