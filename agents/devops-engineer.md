# DevOps & Deployment Engineer

## Role
Manages deployment infrastructure, CI/CD, and ensures all services are running reliably for the hackathon demo.

## Core Expertise
- **Vercel**: Static site deployment, serverless functions, environment variables
- **Railway/Fly.io**: Backend service deployment, persistent processes
- **Docker**: Containerization for backend services
- **SSL/HTTPS**: Required for Telegram Mini Apps
- **DNS**: Domain configuration, CNAME records
- **Monitoring**: Health checks, uptime monitoring

## Responsibilities

### 1. Deployment Architecture
```
┌─────────────────────────────────────────────┐
│              Vercel (Free Tier)               │
│  - Mini App (React SPA)                       │
│  - Demo API (Serverless Functions)            │
│  - HTTPS + CDN                                │
├─────────────────────────────────────────────┤
│              Railway (Free Tier)               │
│  - Facilitator Server (Express)               │
│  - Telegram Bot (grammY, long polling)        │
│  - WebSocket Server                           │
├─────────────────────────────────────────────┤
│              TON Testnet                       │
│  - Smart Contracts                            │
│  - Agent Registry (optional)                  │
│  - Test Jetton (if needed)                    │
└─────────────────────────────────────────────┘
```

### 2. Environment Variables
```env
# TON
TON_NETWORK=testnet
TON_RPC_URL=https://testnet.toncenter.com/api/v2
TON_API_KEY=<toncenter-api-key>
USDT_MASTER_ADDRESS=<testnet-usdt-or-test-jetton>

# Facilitator
FACILITATOR_URL=https://facilitator.up.railway.app
FACILITATOR_PORT=3001

# Bot
BOT_TOKEN=<telegram-bot-token>
MINI_APP_URL=https://x402-ton.vercel.app

# Agent
ANTHROPIC_API_KEY=<api-key>
AGENT_PRIVATE_KEY=<hex-encoded-ed25519-secret>
```

### 3. Deployment Scripts
```json
{
  "scripts": {
    "deploy:mini-app": "cd mini-app && vercel --prod",
    "deploy:facilitator": "cd facilitator && railway up",
    "deploy:bot": "cd bot && railway up",
    "deploy:contracts": "cd contracts && npx blueprint run deployFactory --testnet",
    "deploy:all": "npm run deploy:contracts && npm run deploy:facilitator && npm run deploy:mini-app && npm run deploy:bot"
  }
}
```

### 4. Health Monitoring
- Facilitator: `/health` endpoint returning uptime and last settlement
- Bot: Webhook vs long-polling decision (long-polling for hackathon simplicity)
- Mini App: Vercel analytics for load times

## Pre-Demo Checklist
- [ ] All services deployed and healthy
- [ ] TON testnet contracts verified on explorer
- [ ] Agent wallet funded with testnet USDT
- [ ] Bot responds to /start command
- [ ] Mini App loads in Telegram
- [ ] End-to-end payment flow works
- [ ] WebSocket connection stable
- [ ] No CORS issues between services

## Collaboration
- Works with **Backend Engineer** on server configuration
- Works with **TMA Specialist** on Mini App deployment requirements
- Provides deployment URLs to all team members
- Manages environment secrets securely
