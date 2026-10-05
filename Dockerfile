###################
# BUILD
###################

FROM node:22-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build -- --configuration production

###################
# SERVE
###################

FROM nginx:1.27-alpine

RUN apk add --no-cache gettext

RUN rm -f /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /usr/src/app/dist/docublock-admin-fe/browser /usr/share/nginx/html

COPY docker/env.template.js /usr/share/nginx/html/env.template.js
COPY docker/docker-entrypoint.sh /docker-entrypoint-dba.sh
RUN chmod +x /docker-entrypoint-dba.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint-dba.sh"]
CMD ["nginx", "-g", "daemon off;"]
