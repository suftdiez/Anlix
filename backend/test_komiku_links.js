const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://komiku.org').then(r => {
  const $ = cheerio.load(r.data);
  const links = [];
  $('a').each((i, el) => {
    if(i < 50) links.push($(el).attr('href'));
  });
  console.log(links);
});
