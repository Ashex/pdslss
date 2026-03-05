FROM node:alpine

ENV APP_DOMAIN="pdsls.northsky.social"
ENV APP_PROTOCOL="https"

RUN node scripts/generate-metadata.js

RUN apk add --no-cache git
RUN npm install -g pnpm
RUN git clone https://tangled.org/pds.ls/pdsls /build

WORKDIR /build

RUN pnpm install
RUN pnpm build

COPY /build/dist/* /app/

VOLUME /app
