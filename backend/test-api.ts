import * as dramadash from './src/services/dramadash';

async function test() {
  try {
    console.log('=== Testing DramaDash API ===');
    const result = await dramadash.getHome();
    console.log('=== RESULT ===');
    console.log('Status:', result?.status);
    console.log('Has data:', !!result?.data);
    console.log('Banner count:', result?.data?.banner?.length || 0);
    console.log('Drama count:', result?.data?.drama?.length || 0);
    console.log('Trending count:', result?.data?.trending?.length || 0);
  } catch (err: any) {
    console.log('=== ERROR ===');
    console.log('Message:', err.message);
  }
}

test();
