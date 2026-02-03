// Simplified test script to debug reading history API
const http = require('http');
const uniqueId = Date.now();

// Step 1: Register a new user
const registerData = JSON.stringify({
  email: `test${uniqueId}@test.com`,
  password: 'password123',
  username: `tester${uniqueId}`
});

console.log('=== Registering new user ===');

const registerReq = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': registerData.length
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Register status:', res.statusCode);
    const parsed = JSON.parse(data);
    if (parsed.token) {
      console.log('Token received: OK');
      testSaveProgress(parsed.token);
    } else {
      console.log('No token:', data);
    }
  });
});

registerReq.on('error', (e) => console.error('Register error:', e.message));
registerReq.write(registerData);
registerReq.end();

function testSaveProgress(token) {
  console.log('\n=== Testing save progress ===');
  
  const progressData = JSON.stringify({
    contentType: 'komik',
    contentSlug: 'boundless-necromancer',
    contentTitle: 'Boundless Necromancer',
    contentPoster: '',
    chapterSlug: 'boundless-necromancer-chapter-1',
    chapterNumber: '1',
    chapterTitle: 'Chapter 1'
  });
  
  console.log('Request body:', progressData);

  const req = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/user/reading-history',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': progressData.length,
      'Authorization': 'Bearer ' + token
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('\n=== RESULT ===');
      console.log('Status:', res.statusCode);
      console.log('Response:', data);
    });
  });

  req.on('error', (e) => console.error('Request error:', e.message));
  req.write(progressData);
  req.end();
}
