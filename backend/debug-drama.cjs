// debug-drama.cjs 
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

    // Get drama detail
    console.log('\n2. Getting drama detail for ID 85...');
    const dramaRes = await axios.get('https://www.dramadash.app/api/drama/85', {
      headers: {
        ...headers,
        'authorization': `Bearer ${token}`,
      },
    });

    console.log('\nDrama response structure:');
    console.log('Top-level keys:', Object.keys(dramaRes.data || {}));
    
    if (dramaRes.data) {
      console.log('\nDrama name:', dramaRes.data.name || dramaRes.data.data?.name);
      console.log('Episodes key exists:', 'episodes' in dramaRes.data);
      console.log('episodeList key exists:', 'episodeList' in dramaRes.data);
      
      // Show full structure
      console.log('\nFull response (first 2000 chars):');
      console.log(JSON.stringify(dramaRes.data, null, 2).substring(0, 2000));
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
