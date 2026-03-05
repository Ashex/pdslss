FROM node:alpine

ENV APP_DOMAIN="pdsls.northsky.social"
ENV APP_PROTOCOL="https"

RUN apk add --no-cache git
RUN npm install -g pnpm

COPY ./scripts ./scripts
RUN node scripts/generate-metadata.js

RUN git clone https://tangled.org/pds.ls/pdsls /build

WORKDIR /build

RUN pnpm install
RUN pnpm build

RUN cp -r /build/dist/* /app/

VOLUME /app
