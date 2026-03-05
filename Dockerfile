# NPM build layer

FROM node:alpine AS build

ARG APP_DOMAIN
ARG APP_PROTOCOL
ENV APP_DOMAIN=${APP_DOMAIN}
ENV APP_PROTOCOL=${APP_PROTOCOL}

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN node scripts/generate-metadata.js
RUN pnpm build

# NGINX serving layer

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
