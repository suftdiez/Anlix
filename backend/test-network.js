// Debug script to intercept network requests and find embed URLs
const puppeteer = require('puppeteer');

const url = 'https://tv7.lk21official.cc/kitab-sijjin-2018';

async function analyze() {
  let browser;
  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    // Collect all network requests
    const requests = [];
    page.on('request', req => {
      const reqUrl = req.url();
      // Filter for potential embed/player URLs
      if (reqUrl.includes('embed') || reqUrl.includes('player') || 
          reqUrl.includes('hydrax') || reqUrl.includes('turbo') ||
          reqUrl.includes('p2p') || reqUrl.includes('cast') ||
          reqUrl.includes('stream') || reqUrl.includes('video') ||
          reqUrl.includes('.mp4') || reqUrl.includes('.m3u8')) {
        requests.push({
          url: reqUrl,
          type: req.resourceType(),
        });
      }
    });
    
    console.log('Navigating to:', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for dynamic content
    console.log('Waiting 5 seconds...');
    await new Promise(r => setTimeout(r, 5000));

    // Get all frames including iframes
    const frames = page.frames();
    console.log('\n=== ALL FRAMES ===');
    frames.forEach((frame, i) => {
      console.log(`Frame ${i}: ${frame.url()}`);
    });

    // Extract video/embed sources from each frame
    console.log('\n=== SEARCHING EACH FRAME FOR SOURCES ===');
    for (const frame of frames) {
      try {
        const frameData = await frame.evaluate(() => {
          const data = {
            url: window.location.href,
            videos: [],
            sources: [],
            iframes: [],
          };

          // Get video elements
          document.querySelectorAll('video, source').forEach(el => {
            data.videos.push({
              tag: el.tagName,
              src: el.src || el.getAttribute('data-src'),
            });
          });

          // Get iframes
          document.querySelectorAll('iframe').forEach(el => {
            data.iframes.push({
              src: el.src || el.getAttribute('data-src'),
            });
          });

          // Look for any data attribute with embed/stream URLs
          document.querySelectorAll('[data-embed], [data-stream], [data-src], [data-video]').forEach(el => {
            data.sources.push({
              tag: el.tagName,
              class: el.className?.substring?.(0, 50),
              dataEmbed: el.getAttribute('data-embed'),
              dataStream: el.getAttribute('data-stream'),
              dataSrc: el.getAttribute('data-src'),
              dataVideo: el.getAttribute('data-video'),
            });
          });

          return data;
        }).catch(() => null);
        
        if (frameData) {
          console.log(`\nFrame: ${frameData.url?.substring(0, 80)}`);
          if (frameData.videos.length) console.log('Videos:', JSON.stringify(frameData.videos, null, 2));
          if (frameData.iframes.length) console.log('Iframes:', JSON.stringify(frameData.iframes, null, 2));
          if (frameData.sources.length) console.log('Sources:', JSON.stringify(frameData.sources, null, 2));
        }
      } catch (e) {
        console.log('Frame error:', e.message);
      }
    }

    console.log('\n=== INTERCEPTED REQUESTS ===');
    console.log(JSON.stringify(requests, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

analyze();
