const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('samehadaku.html', 'utf8');
const $ = cheerio.load(html);
const posts = $('.animpost');
console.log('Posts (.animpost) found:', posts.length);
if (posts.length > 0) {
  console.log('First .animpost HTML:', $(posts[0]).html());
}

const listupd = $('.listupd .bs');
console.log('Posts (.listupd .bs) found:', listupd.length);
if (listupd.length > 0) {
  console.log('First .listupd .bs HTML:', $(listupd[0]).html());
}

const dtla = $('.post-show ul li');
console.log('Posts (.post-show ul li) found:', dtla.length);
if (dtla.length > 0) {
  console.log('First .post-show ul li HTML:', $(dtla[0]).html());
}
