const puppeteer = require('puppeteer');

async function debugKuramanime() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  
  // Detail page analysis
  console.log('=== DETAIL PAGE ANALYSIS ===');
  await page.goto('https://v13.kuramanime.tel/anime/2020/school-days', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  
  const detailInfo = await page.evaluate(() => {
    // Get ALL img elements
    const imgs = Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.src || img.dataset?.src || '',
      alt: img.alt || '',
      class: img.className,
      width: img.width,
    })).filter(img => img.src && !img.src.includes('icon') && !img.src.includes('logo'));
    
    // Get page title
    const title = document.querySelector('h1')?.textContent?.trim() || 
                  document.querySelector('.anime-title, .title')?.textContent?.trim() || '';
    
    // Get all text containers that look like synopsis
    const textContainers = Array.from(document.querySelectorAll('p')).map(p => ({
      text: p.textContent?.trim().substring(0, 100) || '',
      class: p.className,
    })).filter(p => p.text.length > 50);
    
    // Get episode links
    const episodeLinks = Array.from(document.querySelectorAll('a[href*="episode"]')).map(a => ({
      href: a.href,
      text: a.textContent?.trim(),
    })).slice(0, 5);
    
    return { 
      title, 
      imgs: imgs.slice(0, 5), 
      textContainers: textContainers.slice(0, 3),
      episodeLinks,
    };
  });
  
  console.log('Title:', detailInfo.title);
  console.log('\nImages found:');
  detailInfo.imgs.forEach((img, i) => console.log(`  [${i}] ${img.src.substring(0, 80)}... (class: ${img.class})`));
  console.log('\nText containers (possible synopsis):');
  detailInfo.textContainers.forEach((t, i) => console.log(`  [${i}] (class: ${t.class}) "${t.text}..."`));
  console.log('\nEpisode links:', detailInfo.episodeLinks.length);
  detailInfo.episodeLinks.forEach(ep => console.log(`  - ${ep.text}: ${ep.href}`));
  
  // Now search page
  console.log('\n\n=== SEARCH PAGE ANALYSIS ===');
  await page.goto('https://v13.kuramanime.tel/anime?search=jujutsu&order_by=popular', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  
  const searchInfo = await page.evaluate(() => {
    // Find all card-like elements
    const containers = document.querySelectorAll('[class*="col-"], .card, .anime-card, .product__item');
    const cards = [];
    
    containers.forEach(el => {
      const link = el.querySelector('a[href*="/anime/"]');
      const img = el.querySelector('img');
      const title = el.querySelector('h5, .title, span:not(.badge)')?.textContent?.trim();
      
      if (link && (img || title)) {
        cards.push({
          href: link.href,
          imgSrc: img?.src || img?.dataset?.src || img?.getAttribute('data-setbg') || '',
          imgStyle: img?.getAttribute('style') || '',
          title: title || '',
          containerClass: el.className,
        });
      }
    });
    
    return cards.slice(0, 5);
  });
  
  console.log('Cards found:', searchInfo.length);
  searchInfo.forEach((c, i) => {
    console.log(`\n[${i}] "${c.title}"`);
    console.log(`    href: ${c.href}`);
    console.log(`    img: ${c.imgSrc.substring(0, 80)}`);
    console.log(`    class: ${c.containerClass}`);
  });
  
  await browser.close();
  console.log('\nDone!');
}

debugKuramanime().catch(console.error);
