const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        await page.goto('https://v17.kuramanime.ink/anime/185/naruto', {waitUntil: 'networkidle2'});
        
        const maxEp = await page.evaluate(() => {
            let max = 0;
            const episodeLinks = document.querySelectorAll('a[href*="/episode/"]');
            episodeLinks.forEach(a => {
                const href = a.href || '';
                const m = href.match(/\/episode\/(\d+)/);
                if (m && parseInt(m[1]) > max) {
                    max = parseInt(m[1]);
                }
            });
            return max;
        });

        console.log('[TEST] Max Episode found from HREFs:', maxEp);
        await browser.close();
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
