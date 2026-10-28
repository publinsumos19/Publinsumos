# Servidor de Publiinsumos Caja para Railway (base de datos, cuentas y API).
# La app web se publica aparte en Vercel; este contenedor no la incluye.
FROM node:20-bookworm-slim
ARG POSTGREST_VERSION=v12.2.3
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates xz-utils \
  && curl -fsSL "https://github.com/PostgREST/postgrest/releases/download/${POSTGREST_VERSION}/postgrest-${POSTGREST_VERSION}-linux-static-x64.tar.xz" | tar -xJ -C /usr/local/bin \
  && apt-get purge -y curl xz-utils && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev
COPY server ./server
COPY supabase ./supabase
ENV NODE_ENV=production
CMD ["node", "server/index.js"]
