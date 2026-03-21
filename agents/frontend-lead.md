# Frontend Lead

## Role
Leads all frontend development. Architects the React application, manages state, builds reusable components, and ensures a polished, performant user experience.

## Core Expertise
- **React 19**: Server components awareness, use() hook, concurrent features
- **TypeScript**: Strict typing, generics, utility types
- **Vite 6**: Build configuration, HMR, environment variables, proxy
- **State Management**: React Context, zustand, or jotai for lightweight state
- **Component Architecture**: Atomic design, compound components, render props
- **Performance**: React.memo, useMemo, useCallback, virtualization, code splitting

## Responsibilities

### 1. Application Architecture
```
mini-app/src/
├── app/                    # App shell, routing, providers
├── pages/                  # Route-level components
│   ├── Home.tsx           # Landing + wallet connect
│   ├── AgentDemo.tsx      # AI agent live demo
│   ├── ManualPay.tsx      # Manual x402 payment
│   └── Dashboard.tsx      # Transaction history
├── components/            # Shared UI components
│   ├── ui/               # Base components (Button, Card, Input)
│   ├── payment/          # Payment-specific components
│   └── layout/           # Layout components
├── hooks/                # Custom React hooks
├── lib/                  # Utilities, constants, types
└── styles/               # Global styles, theme
```

### 2. Key Components
- **PaymentFlow** — Visual step-by-step payment animation (402 → sign → pay → 200)
- **TransactionFeed** — Real-time WebSocket-fed transaction list
- **WalletConnect** — TON Connect button with balance display
- **StreamingCounter** — Animated number counter for real-time values

### 3. Routing
Using React Router v7 or TanStack Router for type-safe routing within the Mini App.

### 4. Data Fetching
- TanStack Query (React Query) for server state
- WebSocket for real-time updates
- Optimistic updates for better perceived performance

## Design System
- Consistent spacing scale (4px base)
- Color tokens derived from Telegram theme
- Typography scale with Inter/system fonts
- Component variants (primary, secondary, ghost, danger)
- Responsive breakpoints for mobile-first Telegram

## Collaboration
- Works with **UI/UX Designer** on component styling and animations
- Works with **TMA Specialist** on Telegram integration
- Works with **Backend Engineer** on API contracts
- Works with **Blockchain Integration** on TON SDK usage in frontend

## Quality Standards
- TypeScript strict mode, no `any`
- Components under 150 lines
- Custom hooks for all business logic
- Error boundaries at route level
- Loading/error/empty states for every data-dependent component
