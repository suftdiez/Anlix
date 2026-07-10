const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://komiku.org').then(r => {
  const $ = cheerio.load(r.data);
  const imgs = [];
  $('img').each((i, el) => {
    if(i < 20) imgs.push(el.attribs);
  });
  console.log(imgs);
});
