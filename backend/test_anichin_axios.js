const axios = require('axios');
axios.get('https://anichin.watch', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
}).then(res => console.log('Status:', res.status, 'HTML length:', res.data.length))
  .catch(err => console.log('Error:', err.message));
