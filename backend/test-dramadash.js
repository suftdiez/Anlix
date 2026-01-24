// Quick test script for DramaDash API
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const API_BASE = 'https://www.dramadash.app/api';

async function testDramaDash() {
  const deviceId = uuidv4().replace(/-/g, '').substring(0, 16);
  console.log('Device ID:', deviceId);

  const api = axios.create({
    baseURL: API_BASE,
    timeout: 30000,
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

  try {
    console.log('\n1. Testing /landing endpoint...');
    const landingRes = await api.post('/landing', {
      android_id: deviceId,
    });
    console.log('Status:', landingRes.status);
    console.log('Data:', JSON.stringify(landingRes.data, null, 2).substring(0, 1000));

    if (landingRes.data?.data?.token) {
      const token = landingRes.data.data.token;
      console.log('\nToken obtained:', token.substring(0, 50) + '...');

      api.defaults.headers.common['authorization'] = `Bearer ${token}`;

      console.log('\n2. Testing /home endpoint...');
      const homeRes = await api.get('/home');
      console.log('Status:', homeRes.status);
      console.log('Data keys:', Object.keys(homeRes.data?.data || {}));
      console.log('First drama:', JSON.stringify(homeRes.data?.data?.drama?.[0], null, 2)?.substring(0, 500));
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2)?.substring(0, 1000));
    }
  }
}

testDramaDash();
