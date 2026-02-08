// Test script to analyze otakudesu.best HTML structure
const axios = require('axios');
const cheerio = require('cheerio');

async function analyzeOtakudesu() {
  try {
    const { data: html } = await axios.get('https://otakudesu.best/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      timeout: 15000,
    });
    const $ = cheerio.load(html);
    
    console.log('=== Otakudesu.best Structure Analysis ===\n');
    
    // Find main containers
    console.log('=== Looking for anime containers ===');
    const selectors = [
      '.venz ul li',
      '.rseries ul li', 
      '.rapi li',
      '.detpost',
      '.bs',
      '.bsx',
      '.anime-list li',
      '.listupd li',
      'article',
      '.post'
    ];
    
    selectors.forEach(sel => {
      const count = $(sel).length;
      if (count > 0) {
        console.log(`${sel}: ${count} items`);
      }
    });
    
    // Check for ongoing section
    console.log('\n=== Looking for section markers ===');
    const sectionSelectors = ['.venz', '.rapi', '.rseries', '.verongoing', '.kolom'];
    sectionSelectors.forEach(sel => {
      const count = $(sel).length;
      if (count > 0) {
        console.log(`${sel}: ${count}`);
        // Show first item structure
        const first = $(sel).first();
        console.log(`  Children: ${first.children().length}`);
        console.log(`  First child tag: ${first.children().first().prop('tagName')}`);
      }
    });
    
    // Find any link with /anime/ pattern
    console.log('\n=== Anime links found ===');
    const animeLinks = $('a[href*="/anime/"]');
    console.log(`Total anime links: ${animeLinks.length}`);
    
    animeLinks.slice(0, 5).each((i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const title = $el.attr('title') || $el.text().trim();
      const parent = $el.parent().attr('class') || 'no class';
      const grandparent = $el.parent().parent().attr('class') || 'no class';
      console.log(`${i+1}. "${title.substring(0, 40)}" -> ${href?.substring(0, 50)}`);
      console.log(`   parent: ${parent}, grandparent: ${grandparent}`);
    });
    
    // Find images near anime links
    console.log('\n=== Image containers ===');
    const imgContainers = $('img[src*="otakudesu"], img[data-src]');
    console.log(`Images found: ${imgContainers.length}`);
    imgContainers.slice(0, 3).each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      console.log(`${i+1}. ${src?.substring(0, 60)}`);
    });

  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

analyzeOtakudesu();
