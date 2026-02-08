const puppeteer = require('puppeteer');

async function testClick() {
  const browser = await puppeteer.launch({
    headless: false, // VISIBLE browser to debug
    args: ['--no-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  
  await page.goto('https://otakudesu.best/episode/btr-nng-episode-293-sub-indo/', { 
    waitUntil: 'networkidle2', 
    timeout: 30000 
  });
  
  // Wait a bit for page to settle
  await new Promise(r => setTimeout(r, 2000));
  
  // Find buttons
  const buttons = await page.$$('[data-content]');
  console.log('Found buttons:', buttons.length);
  
  // Get initial iframe 
  let iframe = await page.$eval('iframe', e => e.src).catch(() => 'none');
  console.log('\nInitial iframe:', iframe);
  
  // Try clicking first 3 buttons
  for (let i = 0; i < Math.min(3, buttons.length); i++) {
    try {
      const btnText = await buttons[i].evaluate(e => e.textContent?.trim());
      console.log(`\nClicking button ${i}: "${btnText}"`);
      
      await buttons[i].click();
      await new Promise(r => setTimeout(r, 1500)); // Wait for AJAX
      
      const newIframe = await page.$eval('iframe', e => e.src).catch(() => 'none');
      console.log(`  New iframe: ${newIframe}`);
      
      if (newIframe !== iframe) {
        console.log('  *** IFRAME CHANGED! ***');
        iframe = newIframe;
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  console.log('\nWaiting 5 seconds to observe...');
  await new Promise(r => setTimeout(r, 5000));
  
  await browser.close();
  console.log('Done!');
}

testClick().catch(console.error);
