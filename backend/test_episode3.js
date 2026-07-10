const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://samehadaku.li/super-no-ura-de-yani-suu-futari-episode-1-subtitle-indonesia/').then(r => {
  const $ = cheerio.load(r.data);
  console.log($('.mirror').html());
});
