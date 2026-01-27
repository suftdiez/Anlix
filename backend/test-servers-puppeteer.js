// Debug script to find server buttons using Puppeteer with longer wait
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
    
    console.log('Navigating to:', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait longer for dynamic content
    console.log('Waiting 10 seconds for JavaScript to fully load...');
    await new Promise(r => setTimeout(r, 10000));

    // Take screenshot
    await page.screenshot({ path: 'c:/Anlix/backend/lk21-player-screenshot.png', fullPage: false });
    console.log('Screenshot saved');

    // Search for any elements containing server names
    const serverData = await page.evaluate(() => {
      const results = {
        serverTabs: [],
        iframes: [],
        buttons: [],
        divWithServerText: [],
      };

      // Get all elements and check text
      const allElements = document.querySelectorAll('*');
      const serverKeywords = ['p2p', 'turbovip', 'hydrax', 'cast', 'ganti', 'player'];
      
      allElements.forEach(el => {
        const text = el.textContent?.trim().toLowerCase() || '';
        const directText = el.childNodes[0]?.nodeType === 3 ? el.childNodes[0].textContent?.trim().toLowerCase() : '';
        
        // Check if this element's direct text content matches
        if (directText && serverKeywords.some(kw => directText.includes(kw))) {
          results.serverTabs.push({
            tag: el.tagName,
            class: el.className,
            id: el.id,
            text: directText.substring(0, 50),
            outerHTML: el.outerHTML?.substring(0, 300),
            onclick: el.getAttribute('onclick')?.substring(0, 100),
            dataAttrs: Array.from(el.attributes)
              .filter(a => a.name.startsWith('data-'))
              .map(a => `${a.name}=${a.value?.substring(0, 50)}`),
          });
        }
      });

      // Get all iframes
      document.querySelectorAll('iframe').forEach(el => {
        results.iframes.push({
          src: el.src,
          dataSrc: el.getAttribute('data-src'),
          id: el.id,
          class: el.className,
        });
      });

      // Get buttons with onclick
      document.querySelectorAll('button, .btn, [onclick]').forEach(el => {
        const onclick = el.getAttribute('onclick');
        if (onclick) {
          results.buttons.push({
            tag: el.tagName,
            text: el.textContent?.trim().substring(0, 30),
            onclick: onclick.substring(0, 200),
          });
        }
      });

      return results;
    });

    console.log('\n=== SERVER TABS ===');
    console.log(JSON.stringify(serverData.serverTabs, null, 2));

    console.log('\n=== IFRAMES ===');
    console.log(JSON.stringify(serverData.iframes, null, 2));

    console.log('\n=== BUTTONS WITH ONCLICK ===');
    console.log(JSON.stringify(serverData.buttons, null, 2));

    // Save HTML
    const html = await page.content();
    require('fs').writeFileSync('c:/Anlix/backend/lk21-player-rendered.html', html);
    console.log('\n--- Rendered HTML saved ---');

  } catch (error) {
    console.error('Error:', error.message, error.stack);
  } finally {
    if (browser) await browser.close();
  }
}

analyze();
