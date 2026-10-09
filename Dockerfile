FROM node:22-alpine AS build
WORKDIR /app
# Prisma 7 loads its config during client generation; this placeholder is build-only.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm prisma generate && pnpm build

FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable && addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/prisma7.config.ts ./prisma7.config.ts
USER app
EXPOSE 3000
CMD ["node", "dist/main.js"]
