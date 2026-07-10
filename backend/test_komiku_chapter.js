const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://komiku.org/tsuihou-sareta-tenshou-juu-kishi-wa-game-chishiki-de-musou-suru-chapter-171/').then(r => {
  const $ = cheerio.load(r.data);
  console.log('readerarea length:', $('#Baca_Komik img').length);
  const images = [];
  $('#Baca_Komik img').each((_, el) => {
    images.push($(el).attr('src') || $(el).attr('data-src'));
  });
  console.log(images.slice(0, 3));
});
