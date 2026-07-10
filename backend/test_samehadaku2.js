const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('samehadaku.html', 'utf8');
const $ = cheerio.load(html);
const list = $('.animepost');
console.log('Posts (.animepost) found:', list.length);
if (list.length > 0) {
  console.log('First .animepost HTML:', $(list[0]).html());
}

const list2 = $('.bsx');
console.log('Posts (.bsx) found:', list2.length);
if (list2.length > 0) {
  console.log('First .bsx HTML:', $(list2[0]).html());
}

const list3 = $('.bixbox');
console.log('Posts (.bixbox) found:', list3.length);
if (list3.length > 0) {
  console.log('First .bixbox HTML:', $(list3[0]).html().substring(0, 500));
}

const list4 = $('.box-list-ep ul li');
console.log('Posts (.box-list-ep ul li) found:', list4.length);
if (list4.length > 0) {
  console.log('First .box-list-ep ul li HTML:', $(list4[0]).html());
}
