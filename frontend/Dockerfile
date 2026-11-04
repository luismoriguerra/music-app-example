# ---- Build stage: full toolchain (devDeps needed for prebuild content gate) ----
FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Astro inlines PUBLIC_* at build time. Railway forwards service variables as
# build args only for ARGs the Dockerfile declares; without this the bundle
# bakes the http://localhost:8000 default and every prod API call fails.
ARG PUBLIC_API_URL
ENV PUBLIC_API_URL=${PUBLIC_API_URL}
RUN npm run build

# ---- Runtime stage: static file server for dist/ ----
FROM node:22-slim AS runtime

WORKDIR /app

RUN npm install -g serve@14

COPY --from=build /app/dist ./dist

# Railway injects $PORT; default 3000 for local `docker run`.
EXPOSE 3000

CMD ["sh", "-c", "serve dist -l tcp://0.0.0.0:${PORT:-3000}"]
