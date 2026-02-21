/**
 * A skill with medium-risk patterns
 */

const http = require('http');
const fs = require('fs');

// MEDIUM: Creates network listener
const server = http.createServer((req, res) => {
  res.end('Hello');
});
server.listen(3000);

// LOW: Network request
async function fetchData(url) {
  return fetch(url);
}

// LOW: File system access
function readConfig(path) {
  return fs.readFile(path, 'utf-8');
}

module.exports = { fetchData, readConfig };
