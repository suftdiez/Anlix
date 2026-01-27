// Debug script to analyze LK21 film page server structure
const axios = require('axios');
const cheerio = require('cheerio');

const url = 'https://tv7.lk21official.cc/kitab-sijjin-2018';

async function analyze() {
  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://tv7.lk21official.cc',
      },
    });

    const $ = cheerio.load(html);

    console.log('=== ANALYZING LK21 SERVER STRUCTURE ===\n');
    
    // Look for all iframes
    console.log('--- IFRAMES ---');
    $('iframe').each((i, el) => {
      console.log('iframe', i, ':', $(el).attr('src') || $(el).attr('data-src'));
    });

    // Look for server buttons
    console.log('\n--- SERVER BUTTONS ---');
    $('[data-server], [data-url], .server-item, .player-option').each((i, el) => {
      const $el = $(el);
      console.log('Server button', i, ':', {
        tag: el.tagName,
        class: $el.attr('class'),
        text: $el.text().trim(),
        'data-server': $el.attr('data-server'),
        'data-url': $el.attr('data-url'),
        href: $el.attr('href'),
      });
    });

    // Look for specific server tab buttons (from screenshot: P2P, TURBOVIP, CAST, HYDRAX)
    console.log('\n--- LOOKING FOR TAB/BUTTON ELEMENTS ---');
    $('a, button, div, span').each((i, el) => {
      const $el = $(el);
      const text = $el.text().trim().toLowerCase();
      const className = ($el.attr('class') || '').toLowerCase();
      
      // Look for server-related keywords
      if (text.includes('p2p') || text.includes('turbo') || text.includes('cast') || 
          text.includes('hydrax') || text.includes('player') || text.includes('server') ||
          className.includes('player') || className.includes('server') || className.includes('tab')) {
        console.log({
          tag: el.tagName,
          class: $el.attr('class'),
          id: $el.attr('id'),
          text: text.substring(0, 50),
          'data-*': Object.entries(el.attribs || {}).filter(([k]) => k.startsWith('data-')),
        });
      }
    });

    // Look for any element with onclick handler
    console.log('\n--- ELEMENTS WITH ONCLICK ---');
    $('[onclick]').each((i, el) => {
      const $el = $(el);
      console.log({
        tag: el.tagName,
        onclick: $el.attr('onclick')?.substring(0, 100),
        text: $el.text().trim().substring(0, 30),
      });
    });

    // Look for any div/span with text P2P, TURBOVIP etc
    console.log('\n--- EXACT MATCH FOR SERVER NAMES ---');
    const serverNames = ['p2p', 'turbovip', 'cast', 'hydrax', 'ganti player'];
    serverNames.forEach(name => {
      $('body *').each((i, el) => {
        const $el = $(el);
        if ($el.text().trim().toLowerCase() === name) {
          console.log(`Found "${name}":`, {
            tag: el.tagName,
            class: $el.attr('class'),
            parent: $el.parent().attr('class'),
            html: $el.prop('outerHTML')?.substring(0, 200),
          });
        }
      });
    });

    // Save HTML for manual inspection
    const fs = require('fs');
    fs.writeFileSync('c:/Anlix/backend/lk21-film-page.html', html);
    console.log('\n--- HTML saved to lk21-film-page.html ---');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyze();
