FROM node:22-slim

WORKDIR /app

# Copy root package files
COPY package.json ./
COPY .npmrc ./

# Copy workspace package files
COPY bot/package.json bot/

# Install all deps
RUN npm install --legacy-peer-deps

# Copy source
COPY bot/ bot/

# Build
RUN cd bot && npx tsc

CMD ["node", "bot/dist/bot.js"]
