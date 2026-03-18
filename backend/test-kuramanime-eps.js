const puppeteer = require('puppeteer');

const url = 'https://v17.kuramanime.ink/anime/185/naruto';

(async () => {
  console.log(`[TEST] Navigating to ${url}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Intercept XHR/Fetch requests to see if episodes are loaded via API
  page.on('response', async (response) => {
    const reqUrl = response.url();
    if (reqUrl.includes('episode') || reqUrl.includes('anime/185')) {
      if (response.request().resourceType() === 'xhr' || response.request().resourceType() === 'fetch') {
        console.log(`[NETWORK] XHR/Fetch: ${reqUrl}`);
      }
    }
  });

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  console.log('[TEST] Clicking #episodeLists...');
  try {
    await page.click('#episodeLists');
    await new Promise(r => setTimeout(r, 2000));
  } catch (e) {
    console.log('[TEST] Failed to click #episodeLists');
  }

  // Check the DOM for episodes
  const data = await page.evaluate(() => {
    const episodes = [];
    document.querySelectorAll('a[href*="/episode/"]').forEach(a => {
      episodes.push({
        text: a.textContent.trim(),
        href: a.getAttribute('href')
      });
    });

    const paginators = [];
    document.querySelectorAll('#episodeLists ~ div a, .episodes-list a, [id*="episode"] a.page-link').forEach(a => {
      paginators.push({
        text: a.textContent.trim(),
        href: a.getAttribute('href'),
        className: a.className
      });
    });

    return { 
      episodesFound: episodes.length, 
      sampleEpisodes: episodes.slice(0, 10),
      allEpisodes: episodes.map(e => e.text).join(', '),
      paginators
    };
  });

  console.log(`[TEST] Found ${data.episodesFound} episode links in DOM`);
  console.log(`[TEST] Episodes text: ${data.allEpisodes}`);
  console.log(`[TEST] Paginator links found:`, data.paginators);

  await browser.close();
})();
