/**
 * A safe skill that does nothing risky
 */

function greet(name) {
  return `Hello, ${name}!`;
}

function add(a, b) {
  return a + b;
}

module.exports = { greet, add };
