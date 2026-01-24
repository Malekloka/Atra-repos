const axios = require('axios');

const requestProcess = async () => {
  const maxRetries = 3;
  const retryDelay = 2000; // 2 seconds
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post('http://localhost:9000/process', {}, {
        timeout: 5000 // 5 second timeout
      });
      console.log('✅ Successfully requested processing from play-with-dreams');
      return; // Success, exit function
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        // Server not running or not responding
        if (attempt < maxRetries) {
          console.warn(`⚠️  play-with-dreams server not available (attempt ${attempt}/${maxRetries}). Retrying in ${retryDelay/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue; // Retry
        } else {
          console.error('❌ ERROR: play-with-dreams server is not running on port 9000');
          console.error('   Processing will not happen automatically. Please:');
          console.error('   1. Start both servers: npm start');
          console.error('   2. Manually trigger processing: POST http://localhost:9000/process');
          console.error('   The dream will be processed when you trigger it manually.');
        }
      } else {
        // Other error
        console.error('❌ Error requesting processing:', err.message);
      }
      break; // Don't retry on other errors
    }
  }
}

module.exports = {
  requestProcess
}