const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('anichin.html', 'utf8');
const $ = cheerio.load(html);
const list = $('.listupd .bs, .bsx, article.bs, .animpost');
console.log('Posts:', list.length);
if (list.length > 0) {
  console.log('First Title:', $(list[0]).find('.tt h2, .tt, .title, h2').first().text().trim());
}
