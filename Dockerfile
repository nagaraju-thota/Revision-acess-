# Build stage
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Backend URL is baked into the JS bundle at build time (Vite)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build

# Serve stage: unprivileged nginx (runs as non-root, listens on 8080)
FROM nginxinc/nginx-unprivileged:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
USER nginx
CMD ["nginx", "-g", "daemon off;"]
