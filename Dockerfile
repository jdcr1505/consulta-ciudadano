# Imagen única para desplegar el backend + la web compilada (mismo origen).
#   docker build -t consulta-ciudadano .
#   docker run -p 4000:4000 --env-file backend/.env -e NODE_ENV=production consulta-ciudadano
# Variables mínimas en producción: ver docs/DESPLIEGUE.md (DATABASE_URL, DIRECT_URL, JWT_ACCESS_SECRET, MAIL_MODE=smtp…)

# --- 1) Compilar la web ---
FROM node:22-slim AS web
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# --- 2) Backend + web compilada ---
FROM node:22-slim
ENV NODE_ENV=production \
    WEB_DIST_DIR=/app/web/dist \
    PORT=4000
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY backend/ ./
RUN node node_modules/prisma/build/index.js generate
COPY --from=web /app/web/dist /app/web/dist
EXPOSE 4000
# Aplica las migraciones pendientes (usa DIRECT_URL) y arranca el servidor.
CMD ["npm", "run", "start:prod"]
