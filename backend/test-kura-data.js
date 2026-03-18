const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    try {
        const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log('[TEST] Navigating...');
        await page.goto('https://v17.kuramanime.ink/anime/185/naruto', {waitUntil: 'networkidle2'});
        
        console.log('[TEST] Waiting for #episodeLists...');
        try {
            await page.waitForSelector('#episodeLists', {timeout: 5000});
            await page.click('#episodeLists');
            await new Promise(r => setTimeout(r, 2000));
        } catch(e) {
            console.log('[TEST] #episodeLists button not clicked:', e.message);
        }

        console.log('[TEST] Evaluating page...');
        const data = await page.evaluate(() => {
            const res = {};
            const wires = document.querySelectorAll('[wire\\:id]');
            const wireData = [];
            wires.forEach((w) => {
                wireData.push({
                    id: w.getAttribute('wire:id'),
                    init: w.getAttribute('wire:initial-data')
                });
            });
            res.wires = wireData;
            
            const eps = Array.from(document.querySelectorAll('a[href*="/episode/"]')).map(a => ({
                href: a.href,
                text: a.textContent.trim()
            }));
            res.episodes = eps;
            return res; /* res */
        });
        
        fs.writeFileSync('c:/Anlix/backend/test-kura-data.json', JSON.stringify(data, null, 2));
        console.log('[TEST] Wrote to JSON file successfully');
        await browser.close();
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
