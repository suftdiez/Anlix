// debug-landing.cjs
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

async function debug() {
  const deviceId = uuidv4().replace(/-/g, '').substring(0, 16);
  console.log('Device ID:', deviceId);

  try {
    const res = await axios.post('https://www.dramadash.app/api/landing', {
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

    console.log('\nFull response:');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }
}

debug();
