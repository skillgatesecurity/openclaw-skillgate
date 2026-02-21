/**
 * Test skill for skillKey resolution
 */

// Has some LOW risk for testing
const fs = require('fs');

function doSomething() {
  return fs.readFile('/tmp/test.txt');
}

module.exports = { doSomething };
