const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://samehadaku.li/?s=yani+neko').then(r => {
  const $ = cheerio.load(r.data);
  $('.animpost a, .animepost a').each((i, el) => {
    console.log($(el).attr('href'));
  });
});
