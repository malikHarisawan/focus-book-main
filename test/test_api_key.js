const http = require('http');

// Test if the API key is working
function testApiKey() {
  console.log('🔑 Testing OpenAI API Key Integration...\n');
  
  const data = JSON.stringify({ 
    message: 'Hello! Please respond with a simple greeting to confirm the API key is working.' 
  });

  const req = http.request({
    hostname: '127.0.0.1',
    port: 8005,
    path: '/chat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    },
    timeout: 15000
  }, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      console.log(`Response Status: ${res.statusCode}\n`);
      
      if (res.statusCode === 200) {
        try {
          const jsonResponse = JSON.parse(responseData);
          if (jsonResponse.reply) {
            console.log('✅ SUCCESS: OpenAI API Key is working!');
            console.log(`🤖 AI Response: "${jsonResponse.reply}"\n`);
            console.log('🎉 Your FocusBook AI Agent is fully operational!');
            console.log('💡 You can now ask questions about your productivity data.');
          } else {
            console.log('❌ Unexpected response format');
            console.log('Response:', responseData);
          }
        } catch (error) {
          console.log('❌ Error parsing JSON response');
          console.log('Raw response:', responseData);
        }
      } else {
        console.log('❌ API request failed');
        console.log('Response:', responseData);
      }
    });
  });

  req.on('error', (err) => {
    console.log('❌ Connection failed:', err.message);
  });

  req.on('timeout', () => {
    console.log('❌ Request timeout');
    req.destroy();
  });

  req.write(data);
  req.end();
}

testApiKey();