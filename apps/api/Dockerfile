# Build a partir da raiz do monorepo: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci --workspace=apps/api --include-workspace-root=false
COPY apps/api ./apps/api
RUN npm run prisma:generate --workspace=apps/api \
 && npm run build --workspace=apps/api \
 && npm prune --omit=dev --workspace=apps/api

FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
WORKDIR /app/apps/api
USER node
EXPOSE 3333
# Aplica as migracoes pendentes antes de subir a API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
