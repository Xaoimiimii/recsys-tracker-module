# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy package.json
COPY package.json ./

# Install all dependencies
RUN npm install

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Regenerate Prisma client for linux
RUN npx prisma generate

# Recompile only the generated prisma files
RUN rm -rf /app/dist/src/generated && npx tsc src/generated/prisma/*.ts src/generated/prisma/**/*.ts --outDir dist/src/generated/prisma --skipLibCheck --declaration --esModuleInterop --module commonjs --target ES2020 --moduleResolution node 2>/dev/null || npm run build

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "dist/src/main.js"]
