const puppeteer = require('puppeteer');

async function test() {
  console.log('=== Puppeteer Stream Extraction Test ===');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--allow-running-insecure-content',
    ],
  });
  
  const page = await browser.newPage();
  
  // Set the user agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  
  // Set extra headers - including Referer for the embed host
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
  });
  
  // Track all network requests and responses
  const networkRequests = [];
  let m3u8Response = null;
  let m3u8Url = null;
  
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('groovy.monster') || url.includes('/api/')) {
      console.log(`[REQ] ${req.method()} ${url.substring(0, 120)}`);
    }
  });
  
  page.on('response', async (resp) => {
    const url = resp.url();
    const status = resp.status();
    
    if (url.includes('groovy.monster')) {
      console.log(`[RESP] ${status} ${url.substring(0, 120)}`);
      
      if (url.includes('/stream/') && status === 200) {
        m3u8Url = url;
        try {
          const body = await resp.text();
          m3u8Response = body;
          console.log('*** m3u8 CAPTURED! ***');
          console.log('Content:', body.substring(0, 500));
        } catch(e) {
          console.log('Could not read response body:', e.message);
        }
      }
      
      if (status === 403) {
        try {
          const body = await resp.text();
          console.log(`[403 body]: ${body.substring(0, 200)}`);
        } catch {}
      }
    }
    
    if (url.includes('/api/')) {
      console.log(`[API] ${status} ${url.substring(0, 120)}`);
      if (status === 200) {
        try {
          const body = await resp.text();
          console.log(`[API body]: ${body.substring(0, 300)}`);
        } catch {}
      }
    }
  });
  
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('error') || text.includes('Error') || text.includes('fail') || text.includes('403')) {
      console.log(`[CONSOLE ${msg.type()}]: ${text.substring(0, 200)}`);
    }
  });
  
  // Navigate to the embed page with correct Referer
  console.log('\nNavigating to embed page...');
  await page.goto('https://95.214.54.154/embed/GVGJqC0kpb0cOFr', {
    referer: 'https://rebahinxxi3.work/',
    waitUntil: 'networkidle2',
    timeout: 30000,
  });
  
  console.log('\nPage loaded. Title:', await page.title());
  
  // Wait for JWPlayer to initialize and start loading the stream
  console.log('Waiting for stream requests...');
  await new Promise(r => setTimeout(r, 5000));
  
  // Try to click the play button
  try {
    await page.click('.jw-icon-display');
    console.log('Clicked play button');
  } catch {
    console.log('No play button found, trying to click center of page');
    await page.click('body');
  }
  
  // Wait more for stream to load
  await new Promise(r => setTimeout(r, 10000));
  
  if (m3u8Response) {
    console.log('\n\n=== SUCCESS! m3u8 was captured ===');
    console.log('URL:', m3u8Url);
    console.log('Content length:', m3u8Response.length);
    console.log('Full content:\n', m3u8Response);
  } else {
    console.log('\n\n=== No m3u8 response captured ===');
    console.log('Checking page state...');
    
    // Take a screenshot
    await page.screenshot({ path: 'puppeteer-embed.png' });
    console.log('Screenshot saved to puppeteer-embed.png');
    
    // Check for errors
    const errorText = await page.evaluate(() => {
      const err = document.querySelector('.jw-error-text, .jw-title-primary');
      return err ? err.textContent : 'no error element found';
    });
    console.log('Error text:', errorText);
  }
  
  await browser.close();
}

test().catch(console.error);
