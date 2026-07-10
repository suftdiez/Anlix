const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://komiku.org').then(r => {
  const $ = cheerio.load(r.data);
  console.log($('title').text());
  console.log('Items in .bintang:', $('.bintang').length);
  console.log('Items in .ls4 or .ls4j:', $('.ls4, .ls4j').length);
}).catch(e => console.log(e.message));
