#!/bin/bash
# Double-click on a Mac to start Naadamy (needs Node.js from nodejs.org).
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then echo "Node.js is not installed. Download it free from https://nodejs.org"; read -n 1; exit 1; fi
node server.js
read -n 1 -p "Press any key to close…"
