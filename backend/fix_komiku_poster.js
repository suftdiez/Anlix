const fs = require('fs');
let content = fs.readFileSync('src/scrapers/komiku.ts', 'utf8');
content = content.replace(/img\.attr\('src'\) \|\| img\.attr\('data-src'\)/g, "img.attr('data-src') || img.attr('src')");
fs.writeFileSync('src/scrapers/komiku.ts', content);
