# Stage 1: build the React app with Vite.
# client/.env.production (Firebase web config, VITE_API_BASE_URL=/api) is read at build time.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Caddy serves the static site, proxies /api to the backend and
# obtains/renews the HTTPS certificate automatically.
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80 443 443/udp
