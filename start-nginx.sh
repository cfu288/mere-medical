#!/usr/bin/env bash
# envsubst < /usr/share/nginx/html/config.env > /usr/share/nginx/html/config.tmp.env 
# mv /usr/share/nginx/html/config.tmp.env /usr/share/nginx/html/config.env
# cat /usr/share/nginx/html/config.env

export EXISTING_VARS=$(printenv | awk -F= '{print $1}' | sed 's/^/\$/g' | paste -sd,);
for file in $JSFOLDER;
do
  envsubst $EXISTING_VARS < $file | sponge $file 
done

nginx -g 'daemon off;'