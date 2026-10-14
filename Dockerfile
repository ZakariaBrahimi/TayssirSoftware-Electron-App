# Self-hosted web server for Mizan POS.
#   docker build -t mizan-pos .
#   docker run -d --name mizan --restart unless-stopped -p 3000:3000 -v mizan-data:/data \
#     -e BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
#     -e BETTER_AUTH_URL=http://localhost:3000 mizan-pos
#
# Vendor CLI (bundled in the image, uses the container's database):
#   docker exec -it mizan node admin.mjs <command>

FROM node:22-bookworm-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/desktop/package.json apps/desktop/
RUN npm ci --workspace @tayssir/web --include-workspace-root --ignore-scripts

FROM deps AS build
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @tayssir/web

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/data/tayssir.db
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
COPY --from=build /repo/apps/web/drizzle ./apps/web/drizzle
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["node", "server.js"]
