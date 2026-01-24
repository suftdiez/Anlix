// debug-home.cjs
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

async function debug() {
  const deviceId = uuidv4().replace(/-/g, '').substring(0, 16);
  console.log('Device ID:', deviceId);

  const headers = {
    'app-version': '70',
    'lang': 'id',
    'platform': 'android',
    'tz': 'Asia/Bangkok',
    'device-type': 'phone',
    'user-agent': 'okhttp/5.1.0',
    'content-type': 'application/json; charset=UTF-8',
  };

  try {
    // Get token
    console.log('\n1. Getting token...');
    const landingRes = await axios.post('https://www.dramadash.app/api/landing', {
      android_id: deviceId,
    }, { headers });

    const token = landingRes.data.token;
    console.log('Token obtained:', token ? 'YES' : 'NO');

    // Get home
    console.log('\n2. Getting home data...');
    const homeRes = await axios.get('https://www.dramadash.app/api/home', {
      headers: {
        ...headers,
        'authorization': `Bearer ${token}`,
      },
    });

    console.log('\nHome response structure:');
    console.log('Top-level keys:', Object.keys(homeRes.data || {}));
    
    if (homeRes.data?.data) {
      console.log('data keys:', Object.keys(homeRes.data.data || {}));
      console.log('data.banner count:', homeRes.data.data.banner?.length || 0);
      console.log('data.drama count:', homeRes.data.data.drama?.length || 0);
      console.log('data.trending count:', homeRes.data.data.trending?.length || 0);
      
      if (homeRes.data.data.drama?.length > 0) {
        console.log('\nFirst drama:', JSON.stringify(homeRes.data.data.drama[0], null, 2));
      }
    } else {
      console.log('No "data" key. Full response:', JSON.stringify(homeRes.data, null, 2).substring(0, 1000));
    }

  } catch (e) {
    console.log('Error:', e.message);
    if (e.response) {
      console.log('Status:', e.response.status);
      console.log('Response:', JSON.stringify(e.response.data).substring(0, 500));
    }
  }
}

debug();
