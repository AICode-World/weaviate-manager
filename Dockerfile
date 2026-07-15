# ============================================================
# Weaviate Manager — Multi-stage Docker build
# Stage 1: build the Vite SPA with Node 22
# Stage 2: serve it via nginx:alpine (~30MB final image)
# ============================================================

# ---------- Stage 1: build ----------
FROM node:22-alpine AS build

# Build-time configurable default Weaviate URL.
# End users can still override this in the UI after launch.
ARG VITE_DEFAULT_WEAVIATE_URL=http://localhost:8080
ARG VITE_APP_TITLE=Weaviate Manager

WORKDIR /app

# Install deps first to leverage Docker layer caching
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy source and build
COPY . .
RUN npm run build

# ---------- Stage 2: serve ----------
# Use nginx STABLE branch (1.26.x) — receives only security patches and
# critical bug fixes, no new features. For reproducible builds, the major
# version is pinned so it won't silently jump to 1.28 when a new stable
# branch is released. Minor/patch versions (e.g. 1.26.2 → 1.26.3) still
# flow in automatically for security fixes.
FROM nginx:1.26-alpine AS production

# Remove default site
RUN rm -f /etc/nginx/conf.d/default.conf

# Custom nginx config (SPA fallback + gzip + caching)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from stage 1
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Healthcheck — hit the SPA entry point
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
