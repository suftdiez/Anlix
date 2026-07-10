const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://komiku.org').then(r => {
  const $ = cheerio.load(r.data);
  const comics = [];
  $('a[href*="/manga/"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      if (href.includes('-chapter-')) return;
      const match = href.match(/\/manga\/([^\/]+)/);
      const slug = match ? match[1] : '';
      if (!slug) return;
      
      const title = $el.find('h3').first().text().trim() || $el.attr('title') || '';
      const img = $el.find('img').first();
      const poster = img.attr('src') || img.attr('data-src') || '';
      comics.push({slug, title, poster});
  });
  console.log(comics.length, comics[0]);
});
