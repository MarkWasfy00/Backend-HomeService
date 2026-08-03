# Prisma's schema engine is a native binary picked to match the platform, so
# dependencies are installed inside the image instead of being copied from the
# host - a node_modules built on the host would carry the wrong one.

# --- build: install everything, generate the client, compile TypeScript ------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# The schema engine links against OpenSSL; `prisma migrate` fails without it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

# `npm run build` is `prisma generate && tsc`, in that order: the client is
# written to src/generated/prisma, which tsc then compiles into dist/ along
# with everything else.
RUN npm run build

# This stage is also what the `migrate` service runs, because applying
# migrations needs the Prisma CLI and prisma/migrations, neither of which
# belongs in the runtime image.

# --- runtime: production dependencies and the compiled output only -----------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Uploaded documents land here. Creating it in the image, owned by `node`, is
# also what gives the compose volume mounted over it the right ownership -
# Docker seeds a fresh named volume from whatever is already at the mount point,
# and a directory it creates itself would belong to root and be unwritable.
RUN mkdir -p /app/uploads && chown node:node /app/uploads

USER node
EXPOSE 3000

CMD ["node", "dist/index.js"]
