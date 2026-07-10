const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://samehadaku.li/super-no-ura-de-yani-suu-futari-episode-1-subtitle-indonesia/').then(r => {
  const $ = cheerio.load(r.data);
  console.log('Finding anything with server or player:');
  $('*').each((i, el) => {
    const classList = $(el).attr('class') || '';
    if (classList.includes('server') || classList.includes('player') || classList.includes('mirror')) {
      console.log($(el).prop('tagName'), classList);
    }
  });
});
