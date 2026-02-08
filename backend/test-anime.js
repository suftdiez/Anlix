// Debug - exact scraper simulation
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://v1.samehadaku.how';

function extractAnimeSlugFromEpisodeUrl(episodeUrl) {
  const parts = episodeUrl.split('/').filter(Boolean).pop() || '';
  let slug = parts
    .replace(/-episode-\d+.*$/i, '')
    .replace(/-subtitle-indonesia$/i, '')
    .replace(/-sub-indo$/i, '');
  return slug;
}

async function testGetLatestAnime() {
  try {
    console.log('Fetching:', BASE_URL);
    const response = await axios.get(BASE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      timeout: 15000,
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    console.log('\n=== Checking selectors ===');
    console.log('.dtla items:', $('.dtla').length);
    console.log('.post-show ul li:', $('.post-show ul li').length);
    console.log('.listupd .bs:', $('.listupd .bs').length);
    console.log('.bsx:', $('.bsx').length);
    console.log('article.bs:', $('article.bs').length);
    console.log('.animpost:', $('.animpost').length);

    const animeList = [];
    const seen = new Set();

    const selector = '.dtla, .post-show ul li, .listupd .bs, .bsx, article.bs, .animpost';
    console.log('\n=== Total items from selector ===');
    console.log('Count:', $(selector).length);

    $(selector).each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href') || '';
      
      let title = $el.find('.entry-title').text().trim() ||
                  $el.find('.lftinfo h2').text().trim() ||
                  $el.find('.tt h2').text().trim() ||
                  $el.find('.tt').text().trim() ||
                  $el.find('.title').text().trim() ||
                  $el.find('h2').text().trim() ||
                  linkEl.attr('title') || '';
      
      const poster = $el.find('.thumbass img, .imgseries img').attr('src') || 
                     $el.find('img').attr('src') || 
                     $el.find('img').attr('data-src') || '';

      if (href && title) {
        let slug = '';
        
        if (href.includes('/anime/')) {
          const match = href.match(/\/anime\/([^/]+)/);
          slug = match ? match[1] : '';
        } else {
          slug = extractAnimeSlugFromEpisodeUrl(href);
        }
        
        title = title.replace(/Episode\s*\d+.*$/i, '').trim();
        title = title.substring(0, 100);
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        animeList.push({
          title,
          slug,
          poster: poster.substring(0, 50),
          url: `${BASE_URL}/anime/${slug}/`,
        });
      }
    });

    console.log('\n=== Results ===');
    console.log('Total anime found:', animeList.length);
    
    animeList.slice(0, 10).forEach((a, i) => {
      console.log(`${i+1}. "${a.title}" (${a.slug})`);
    });
    
  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
  }
}

testGetLatestAnime();
