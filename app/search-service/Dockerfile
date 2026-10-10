FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY app ./app
RUN npm ci --workspace app/search-service --workspace app/shared --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
FROM node:22-alpine
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules /app/node_modules
COPY --from=dependencies --chown=node:node /app/app/shared /app/app/shared
COPY --from=dependencies --chown=node:node /app/app/search-service /app/app/search-service
USER 1000:1000
EXPOSE 8080
CMD ["node", "app/search-service/src/index.js"]
