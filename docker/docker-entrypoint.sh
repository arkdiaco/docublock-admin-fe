#!/bin/sh
set -e

envsubst '${CORE_API_URL} ${APP_ENVIRONMENT}' < /usr/share/nginx/html/env.template.js > /usr/share/nginx/html/env.js

exec "$@"
