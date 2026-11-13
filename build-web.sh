#!/bin/bash
set -e
cd /home/bakaryuu/AFFiNE
source ~/.nvm/nvm.sh 2>/dev/null || true
export PATH="/home/bakaryuu/AFFiNE/node_modules/.bin:$PATH"
export PUBLIC_PATH="/"
yarn workspace @affine/web build
