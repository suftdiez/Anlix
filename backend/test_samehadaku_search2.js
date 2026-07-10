const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://samehadaku.li/?s=yani+neko').then(r => {
  const $ = cheerio.load(r.data);
  const posts = $('.bs, .bsx, article, .animpost, li');
  console.log('Posts:', posts.length);
  // Just dump the first few links that contain 'yani-neko'
  $('a').each((i, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('yani')) {
      console.log('Link:', href);
    }
  });
});
