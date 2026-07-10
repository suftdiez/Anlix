const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://komiku.org').then(r => {
  const $ = cheerio.load(r.data);
  const items = $('.ls4, .ls4j, .ls4w, .bintang').parent();
  console.log('Count:', items.length);
  console.log('First HTML:', $.html(items.first()));
});
