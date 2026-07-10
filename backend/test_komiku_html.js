const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://komiku.org').then(r => {
  const $ = cheerio.load(r.data);
  console.log($('.ls4, .ls4j').first().html());
});
