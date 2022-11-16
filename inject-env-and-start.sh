#!/bin/sh
# Inject env files into a static js bundle by doing find and replace
export EXISTING_VARS=$(printenv | awk -F= '{print $1}' | sed 's/^/\$/g' | paste -sd,);
for file in $JSFOLDER;
do
  envsubst $EXISTING_VARS < $file | sponge $file 
done

cd api && node main.js