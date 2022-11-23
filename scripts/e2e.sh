#!/bin/sh
set -e 
yarn bootstrap
yarn clean
yarn test