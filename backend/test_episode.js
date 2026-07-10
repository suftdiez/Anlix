const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://samehadaku.li/super-no-ura-de-yani-suu-futari-episode-1-subtitle-indonesia/').then(r => {
  const $ = cheerio.load(r.data);
  console.log('Player embed:', $('.player-embed').length);
  console.log('Iframe:', $('iframe').length);
  $('iframe').each((i, el) => {
    console.log('Iframe src:', $(el).attr('src'));
  });
  console.log('Servers (.server-list li, .pemain li):', $('.server-list li, .pemain li, .mirror-items li').length);
  $('.server-list li, .pemain li, .mirror-items li').each((i, el) => {
     console.log('Server:', $(el).text().trim(), 'url:', $(el).find('a').attr('data-video') || $(el).find('a').attr('data-url') || $(el).attr('data-video'));
  });
});
