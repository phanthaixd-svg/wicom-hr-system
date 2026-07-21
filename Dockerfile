# ============================================================
#  Wicom Move / Wicer Experience — Docker image (production)
#  Build:  docker build -t wicer-hr .
#  Run:    docker run --env-file .env -p 3000:3000 wicer-hr
#  Entrypoint tự chạy `prisma migrate deploy` (tạo/cập nhật bảng) rồi khởi động app.
#  Seed dữ liệu nền chạy 1 lần riêng: docker run --env-file .env wicer-hr npm run db:seed
# ============================================================

# ---- deps: cài đầy đủ dependencies (kể cả prisma CLI, tsx để chạy migrate/seed trong container) ----
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
RUN npm ci

# ---- builder: sinh Prisma Client + build Next ----
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ---- runner: image chạy thật ----
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV NODE_ENV=production
ENV PORT=3000

# node_modules đầy đủ để chạy được `prisma migrate deploy` + `tsx` (seed) trong container.
COPY --from=deps    /app/node_modules ./node_modules
COPY --from=builder /app/.next        ./.next
COPY --from=builder /app/public       ./public
COPY --from=builder /app/prisma       ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Thư mục upload (ảnh minh chứng / nền thẻ). Gắn volume để không mất khi restart container.
RUN mkdir -p /app/public/uploads
VOLUME ["/app/public/uploads"]

EXPOSE 3000

# Chạy migration (idempotent, an toàn mỗi lần khởi động) rồi start app.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
