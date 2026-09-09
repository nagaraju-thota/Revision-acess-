# ---- Build stage ----
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk update && apk upgrade --no-cache

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# ---- Runtime stage ----
FROM node:22-alpine AS runtime

WORKDIR /app

RUN apk update && apk upgrade --no-cache \
    && rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/data ./data

# Alpine already ships a low-privilege 'node' user in the official
# node:*-alpine images — reuse it instead of creating a new one.
RUN chown -R node:node /app
USER node

EXPOSE 5000

CMD ["node", "server.js"]