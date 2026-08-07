FROM node:20-alpine AS builder
WORKDIR /app
COPY apps/web/package*.json ./apps/web/
COPY package*.json ./
RUN npm install --workspace=apps/web
COPY apps/web ./apps/web
RUN npm run build --workspace=apps/web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package*.json ./apps/web/
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=apps/web"]
