FROM node:22-slim

WORKDIR /app

# Copy root package files
COPY package.json ./
COPY .npmrc ./

# Copy workspace package files
COPY packages/ton/package.json packages/ton/
COPY gateway/package.json gateway/

# Install all deps
RUN npm install --legacy-peer-deps

# Copy source
COPY packages/ton/ packages/ton/
COPY gateway/ gateway/

# Build SDK then gateway
RUN npm run build --workspace=packages/ton
RUN npm run build --workspace=gateway

EXPOSE 4000

CMD ["node", "gateway/dist/server.js"]
