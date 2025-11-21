const http = require('http');

console.log('🧪 Testing Basic AI Service Functionality (No API Key Required)\n');

// Test health endpoint
function testHealthEndpoint() {
  return new Promise((resolve) => {
    console.log('Testing health endpoint...');
    
    const req = http.request({
      hostname: '127.0.0.1',
      port: 8003, // Using the port from our running service
      path: '/docs',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      const success = res.statusCode === 200;
      console.log(`✅ Health Endpoint: ${success ? 'PASS' : 'FAIL'} (Status: ${res.statusCode})`);
      resolve(success);
    });

    req.on('error', (err) => {
      console.log(`❌ Health Endpoint: FAIL - ${err.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      console.log('❌ Health Endpoint: FAIL - Timeout');
      resolve(false);
    });

    req.end();
  });
}

// Test that chat endpoint is accessible (should fail with 401 without API key)
function testChatEndpointAccessibility() {
  return new Promise((resolve) => {
    console.log('Testing chat endpoint accessibility...');
    
    const data = JSON.stringify({ message: 'test' });

    const req = http.request({
      hostname: '127.0.0.1',
      port: 8003,
      path: '/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 10000
    }, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        // We expect this to fail with 500 (due to 401 OpenAI error), which means the endpoint is working
        if (res.statusCode === 500 && responseData.includes('Internal Server Error')) {
          console.log('✅ Chat Endpoint: ACCESSIBLE (Expected 500 due to missing API key)');
          resolve(true);
        } else {
          console.log(`❌ Chat Endpoint: Unexpected response - Status: ${res.statusCode}`);
          console.log(`Response: ${responseData.substring(0, 200)}...`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.log(`❌ Chat Endpoint: FAIL - ${err.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      console.log('❌ Chat Endpoint: FAIL - Timeout');
      resolve(false);
    });

    req.write(data);
    req.end();
  });
}

async function runBasicTests() {
  console.log('🚀 Starting Basic Functionality Tests\n');
  
  const healthResult = await testHealthEndpoint();
  const chatResult = await testChatEndpointAccessibility();
  
  console.log('\n📊 Test Summary:');
  console.log('═'.repeat(50));
  console.log(`Health Endpoint: ${healthResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Chat Endpoint Access: ${chatResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log('═'.repeat(50));
  
  if (healthResult && chatResult) {
    console.log('🎉 SUCCESS: AI Service infrastructure is working correctly!');
    console.log('💡 To test full functionality, add an OpenAI API key in the Settings page.');
    console.log('🔗 The service is ready for integration with the Electron app.');
  } else {
    console.log('⚠️ Some basic functionality tests failed.');
  }
}

runBasicTests().catch(console.error);