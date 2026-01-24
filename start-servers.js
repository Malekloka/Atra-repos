const { spawn } = require('child_process');
const path = require('path');

console.log('Starting both servers...\n');

// Start play-with-dreams server (port 9000)
console.log('Starting play-with-dreams server (port 9000)...');
const server1 = spawn('node', ['server.js'], {
  cwd: path.join(__dirname, 'play-with-dreams'),
  stdio: 'inherit'
});

// Start atra server (port 8000)
console.log('Starting atra server (port 8000)...');
const server2 = spawn('node', ['server.js'], {
  cwd: path.join(__dirname, 'atra'),
  stdio: 'inherit'
});

console.log('\nBoth servers are running!');
console.log('- Homepage: http://localhost:8000/');
console.log('- Dream Map: http://localhost:9000/map');
console.log('\nPress Ctrl+C to stop both servers...\n');

// Handle termination
process.on('SIGINT', () => {
  console.log('\nStopping servers...');
  server1.kill();
  server2.kill();
  process.exit();
});

process.on('SIGTERM', () => {
  server1.kill();
  server2.kill();
  process.exit();
});

// Log child exits so user knows their servers stopped
server1.on('exit', (code, signal) => {
  console.log(`play-with-dreams exited (code=${code}, signal=${signal})`);
});

server2.on('exit', (code, signal) => {
  console.log(`atra exited (code=${code}, signal=${signal})`);
});

