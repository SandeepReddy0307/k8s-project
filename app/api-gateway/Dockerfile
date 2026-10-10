FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY app ./app
RUN npm ci --workspace app/api-gateway --workspace app/shared --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
FROM node:22-alpine
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules /app/node_modules
COPY --from=dependencies --chown=node:node /app/app/shared /app/app/shared
COPY --from=dependencies --chown=node:node /app/app/api-gateway /app/app/api-gateway
USER 1000:1000
EXPOSE 8080
CMD ["node", "app/api-gateway/src/index.js"]
