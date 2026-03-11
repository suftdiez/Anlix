const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

(async () => {
  try {
    const { data } = await axios.get('https://otakudesu.best/episode/nrnt-episode-1-sub-indo/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9',
      },
      timeout: 15000,
    });
    
    fs.writeFileSync('C:/tmp/otakudesu-episode.html', data);
    console.log('Saved HTML! Length:', data.length);
    
    const $ = cheerio.load(data);
    
    // Check for data-content attributes (streaming server buttons)
    console.log('\n=== data-content buttons ===');
    console.log('Count:', $('[data-content]').length);
    $('[data-content]').each((i, el) => {
      const content = $(el).attr('data-content');
      const name = $(el).text().trim();
      console.log(`  Server ${i}: name="${name}", content-len=${content?.length || 0}`);
      if (content) {
        console.log(`    First 200 chars: ${content.substring(0, 200)}`);
        // Try base64 decode
        try {
          const decoded = Buffer.from(content, 'base64').toString('utf8');
          console.log(`    Base64 decoded: ${decoded.substring(0, 200)}`);
        } catch (e) {
          console.log(`    Not base64, raw content`);
        }
      }
    });
    
    // Check iframes
    console.log('\n=== iframes ===');
    $('iframe').each((i, el) => {
      console.log(`  iframe ${i}: src="${$(el).attr('src') || $(el).attr('data-src') || 'none'}"`);
    });
    
    // Check mirrorstream section
    console.log('\n=== .mirrorstream ===');
    console.log('Count:', $('.mirrorstream').length);
    $('.mirrorstream').each((i, el) => {
      const $el = $(el);
      const h4 = $el.find('h4').text().trim();
      console.log(`  Section ${i}: h4="${h4}"`);
      $el.find('a, button').each((j, btn) => {
        const name = $(btn).text().trim();
        const dataContent = $(btn).attr('data-content');
        const href = $(btn).attr('href');
        const onclick = $(btn).attr('onclick');
        console.log(`    Btn ${j}: name="${name}", data-content=${dataContent ? 'YES(' + dataContent.length + ')' : 'NO'}, href=${href || 'none'}, onclick=${onclick?.substring(0, 100) || 'none'}`);
      });
    });
    
    // Check for nonce/ajax info
    console.log('\n=== AJAX/nonce info ===');
    const scriptTags = $('script').toArray();
    for (const s of scriptTags) {
      const text = $(s).html() || '';
      if (text.includes('nonce') || text.includes('ajax') || text.includes('admin-ajax') || text.includes('data-content')) {
        console.log(`  Script with ajax/nonce: ${text.substring(0, 300)}...`);
      }
    }

    // Check for decode_data or similar functions
    console.log('\n=== decode/mirror functions ===');
    for (const s of scriptTags) {
      const text = $(s).html() || '';
      if (text.includes('decode') || text.includes('mirror') || text.includes('atob') || text.includes('base64')) {
        console.log(`  Script with decode: ${text.substring(0, 500)}...`);
      }
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
