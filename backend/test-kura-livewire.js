const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  let livewireDetected = false;
  page.on('response', async (r) => {
    if (r.url().includes('livewire')) {
      livewireDetected = true;
      console.log('[NETWORK] Livewire request:', r.url());
      try {
        const text = await r.text();
        console.log('[NETWORK] Livewire Response (first 100 char):', text.substring(0, 100));
      } catch(e){}
    }
  });

  await page.goto('https://v17.kuramanime.ink/anime/185/naruto', {waitUntil: 'networkidle2'});
  console.log('[TEST] Page loaded. Searching for any script tags containing episode data...');
  
  const scriptData = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script'));
    let found = [];
    for (let s of scripts) {
      if (s.textContent.includes('/episode/') || s.textContent.includes('episodes')) {
        found.push(s.textContent.substring(0, 100) + '...');
      }
    }
    return found;
  });
  console.log('[TEST] Scripts found with episode data:', scriptData.length);
  
  console.log('[TEST] Clicking #episodeLists...');
  await page.click('#episodeLists').catch(() => console.log('Button not found'));
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('[TEST] Checking episode container HTML...');
  const containerHtml = await page.evaluate(() => {
    const btn = document.querySelector('#episodeLists');
    if (!btn) return 'No button';
    
    // Look for Livewire wire:id or similar
    const livewireEl = btn.closest('[wire\\:id]');
    
    return {
      hasLivewire: !!livewireEl,
      wireId: livewireEl ? livewireEl.getAttribute('wire:id') : null,
      wireInit: livewireEl ? livewireEl.getAttribute('wire:initial-data') : null,
      html: btn.nextElementSibling ? btn.nextElementSibling.outerHTML : 'no sibling'
    };
  });
  
  console.log('[TEST] Container data:', JSON.stringify({
    hasLivewire: containerHtml.hasLivewire,
    wireId: containerHtml.wireId,
    wireInitLength: containerHtml.wireInit ? containerHtml.wireInit.length : 0
  }, null, 2));
  
  console.log('[TEST] Clicking pagination ">>" to load next page...');
  try {
    const nextBtn = await page.$('.fa-angle-double-right');
    if (nextBtn) {
      const parent = await nextBtn.evaluateHandle(el => el.parentElement);
      await parent.click();
      await new Promise(r => setTimeout(r, 3000));
      console.log('[TEST] Clicked next page. Waiting for response...');
    } else {
      console.log('[TEST] No >> pagination button found');
    }
  } catch(e) { console.log('[TEST] Failed to click next:', e.message); }
  
  const episodes = await page.evaluate(() => {
    const eps = [];
    document.querySelectorAll('a[href*="/episode/"]').forEach(a => eps.push(a.textContent.trim()));
    return eps;
  });
  console.log('[TEST] Currently visible episodes:', episodes.join(', '));
  
  await browser.close();
})();
