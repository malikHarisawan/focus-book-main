const http = require('http');

// Test the AI service
async function testAIService() {
  try {
    // Test health endpoint
    const healthReq = http.request({
      hostname: '127.0.0.1',
      port: 8002, // Using 8002 from our previous test
      path: '/docs',
      method: 'GET',
      timeout: 2000
    }, (res) => {
      console.log('Health check:', res.statusCode === 200 ? 'PASS' : 'FAIL');
    });

    healthReq.on('error', (err) => {
      console.log('Health check: FAIL -', err.message);
    });

    healthReq.end();

    // Test chat endpoint
    setTimeout(() => {
      const data = JSON.stringify({ message: 'Hello, can you help me analyze my productivity data?' });

      const chatReq = http.request({
        hostname: '127.0.0.1',
        port: 8002,
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
          try {
            const jsonResponse = JSON.parse(responseData);
            console.log('Chat test: PASS');
            console.log('Response:', jsonResponse.reply || jsonResponse);
          } catch (error) {
            console.log('Chat test: FAIL - Invalid JSON response');
            console.log('Raw response:', responseData);
          }
        });
      });

      chatReq.on('error', (err) => {
        console.log('Chat test: FAIL -', err.message);
      });

      chatReq.write(data);
      chatReq.end();
    }, 1000);

  } catch (error) {
    console.error('Test error:', error);
  }
}

testAIService();