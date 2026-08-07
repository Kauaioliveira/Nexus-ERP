FROM node:20-alpine AS builder
WORKDIR /app
COPY apps/api/package*.json ./apps/api/
COPY package*.json ./
RUN npm install --workspace=apps/api
COPY apps/api ./apps/api
RUN npm run prisma:generate --workspace=apps/api
RUN npm run build --workspace=apps/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/package*.json ./apps/api/
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
EXPOSE 3333
CMD ["node", "apps/api/dist/main.js"]
