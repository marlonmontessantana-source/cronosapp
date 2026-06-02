# ---- Build del frontend ----
FROM node:24-bookworm-slim AS webbuild
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# ---- Imagen de producción ----
# Node 24 incluye el módulo nativo 'node:sqlite' (sin compilación nativa).
FROM node:24-bookworm-slim AS runtime
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY server/ ./server/
COPY --from=webbuild /app/web/dist ./web/dist

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data
EXPOSE 3000
VOLUME ["/data"]

CMD ["node", "server/index.js"]
