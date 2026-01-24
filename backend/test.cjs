// test.cjs - CommonJS test for DramaDash
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const API_BASE = 'https://www.dramadash.app/api';

async function test() {
  const deviceId = uuidv4().replace(/-/g, '').substring(0, 16);
  console.log('Device ID:', deviceId);

  try {
    // Step 1: Get token
    console.log('\n>>> Step 1: Get token from /landing');
    const landingRes = await axios.post(`${API_BASE}/landing`, {
      android_id: deviceId,
    }, {
      headers: {
        'app-version': '70',
        'lang': 'id',
        'platform': 'android',
        'tz': 'Asia/Bangkok',
        'device-type': 'phone',
        'user-agent': 'okhttp/5.1.0',
        'content-type': 'application/json; charset=UTF-8',
      },
    });

    console.log('Landing Status:', landingRes.status);
    const token = landingRes.data?.data?.token;
    
    if (!token) {
      console.log('ERROR: No token found in response');
      console.log('Response data structure:', JSON.stringify(Object.keys(landingRes.data || {})));
      return;
    }

    console.log('Token obtained: YES');

    // Step 2: Get home data
    console.log('\n>>> Step 2: Get home data');
    const homeRes = await axios.get(`${API_BASE}/home`, {
      headers: {
        'app-version': '70',
        'lang': 'id',
        'platform': 'android',
        'tz': 'Asia/Bangkok',
        'device-type': 'phone',
        'user-agent': 'okhttp/5.1.0',
        'content-type': 'application/json; charset=UTF-8',
        'authorization': `Bearer ${token}`,
      },
    });

    console.log('Home Status:', homeRes.status);
    console.log('Banner count:', homeRes.data?.data?.banner?.length || 0);
    console.log('Drama count:', homeRes.data?.data?.drama?.length || 0);
    console.log('Trending count:', homeRes.data?.data?.trending?.length || 0);

    if (homeRes.data?.data?.drama?.length > 0) {
      const first = homeRes.data.data.drama[0];
      console.log('\nFirst drama:');
      console.log('  ID:', first.id);
      console.log('  Name:', first.name);
      console.log('  Poster:', first.poster?.substring(0, 50) + '...');
    }

    console.log('\n=== SUCCESS ===');

  } catch (err) {
    console.log('\n=== ERROR ===');
    console.log('Message:', err.message);
    if (err.response) {
      console.log('Response status:', err.response.status);
      console.log('Response data:', JSON.stringify(err.response.data).substring(0, 300));
    }
  }
}

test();
