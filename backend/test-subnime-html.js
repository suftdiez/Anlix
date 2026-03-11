const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

(async () => {
  try {
    // Test a Subnime episode page
    const { data } = await axios.get('https://subnime.com/naruto-shippuuden-episode-1/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9',
        'Referer': 'https://www.google.com/',
      },
      timeout: 15000,
    });
    
    fs.writeFileSync('C:/tmp/subnime-episode.html', data);
    console.log('Saved HTML! Length:', data.length);
    
    const $ = cheerio.load(data);
    
    // Check page title
    console.log('Title:', $('title').text().trim());
    
    // Anti-bot check
    if (data.includes('Mohon tunggu') || data.includes('challenge') || data.includes('verifikasi')) {
      console.log('WARNING: Anti-bot challenge detected!');
    } else {
      console.log('OK: No anti-bot challenge detected');
    }
    
    // Check for streaming elements
    console.log('\n=== iframes ===');
    $('iframe').each((i, el) => {
      console.log('  iframe ' + i + ': src="' + ($(el).attr('src') || $(el).attr('data-src') || 'none') + '"');
    });
    
    // Check data-content
    console.log('\n=== data-content ===');
    console.log('Count:', $('[data-content]').length);
    
    // Check for video/player elements
    console.log('\n=== player/video elements ===');
    console.log('.player:', $('.player').length);
    console.log('.video-content:', $('.video-content').length);
    console.log('#player:', $('#player').length);
    
    // Check for server buttons
    console.log('\n=== server buttons ===');
    $('.server-list a, .mirror a, .quality-list a, [data-video], [data-embed]').each((i, el) => {
      console.log('  btn ' + i + ': text="' + $(el).text().trim() + '", href="' + ($(el).attr('href') || '') + '", data-video="' + ($(el).attr('data-video') || '') + '"');
    });
    
    // Check all links with embed/video patterns
    console.log('\n=== embed/streaming links ===');
    $('a[href*="embed"], a[href*="stream"], a[href*="player"]').each((i, el) => {
      console.log('  link ' + i + ': "' + $(el).text().trim() + '" -> ' + $(el).attr('href'));
    });
    
    // Check script tags for video URLs
    console.log('\n=== Scripts with video/embed/stream ===');
    $('script').each((i, el) => {
      const text = $(el).html() || '';
      if (text.includes('embed') || text.includes('stream') || text.includes('player') || text.includes('iframe') || text.includes('video')) {
        console.log('  Script ' + i + ' (first 300): ' + text.substring(0, 300));
      }
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
