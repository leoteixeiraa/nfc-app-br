FROM node:24.15.0-alpine AS build
WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
RUN npm run build

FROM caddy:2.11.7-alpine AS runtime
COPY --from=build /workspace/dist/ng-tailadmin/browser /srv
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

FROM caddy:2.11.7-builder-alpine AS caddy-builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:2.11.7-alpine AS wildcard-runtime
COPY --from=caddy-builder /usr/bin/caddy /usr/bin/caddy
COPY --from=build /workspace/dist/ng-tailadmin/browser /srv
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
