FROM node:22-slim

WORKDIR /app

# Copy root package files
COPY package.json ./
COPY .npmrc ./

# Copy workspace package files
COPY packages/ton/package.json packages/ton/
COPY agent/package.json agent/

# Install all deps
RUN npm install --legacy-peer-deps

# Copy source
COPY packages/ton/ packages/ton/
COPY agent/ agent/

# Build SDK then agent
RUN npm run build --workspace=packages/ton
RUN cd agent && npx tsc

EXPOSE 4001

CMD ["node", "agent/dist/agent.js"]
