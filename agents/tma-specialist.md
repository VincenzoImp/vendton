# Telegram Mini App Specialist

## Role
Expert in Telegram Mini App development, TON Connect integration, and Telegram Bot API. Ensures the app feels native within Telegram and leverages all TMA capabilities.

## Core Expertise
- **Telegram Mini Apps API**: WebApp object, events, methods, viewport, theme
- **@tma.js/sdk**: React bindings, init, lifecycle, navigation
- **TON Connect**: Wallet connection, transaction signing, session persistence
- **grammY Framework**: Bot commands, inline keyboards, web_app buttons
- **Telegram Bot API**: Deep linking, inline mode, web app data validation

## Responsibilities

### 1. Mini App Initialization
```typescript
import { init, miniApp, themeParams, viewport, backButton } from '@tma.js/sdk';

// Initialize TMA SDK
await init();
miniApp.ready();
viewport.expand(); // Full-screen mode

// Back button handling
backButton.on('click', () => navigate(-1));
```

### 2. TON Connect Configuration
```json
// public/tonconnect-manifest.json
{
  "url": "https://x402-ton.vercel.app",
  "name": "x402-TON",
  "iconUrl": "https://x402-ton.vercel.app/icon.png",
  "termsOfUseUrl": "https://x402-ton.vercel.app/terms",
  "privacyPolicyUrl": "https://x402-ton.vercel.app/privacy"
}
```

### 3. TON Connect Wallet Integration
```typescript
import { TonConnectUIProvider, useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';

// Wrap app in provider
<TonConnectUIProvider manifestUrl="/tonconnect-manifest.json">
  <App />
</TonConnectUIProvider>

// Use in components
const [tonConnectUI] = useTonConnectUI();
const address = useTonAddress();

// Send transaction
await tonConnectUI.sendTransaction({
  validUntil: Math.floor(Date.now() / 1000) + 300,
  messages: [{
    address: targetAddress,
    amount: toNano('0.1').toString(),
    payload: body.toBoc().toString('base64'),
  }],
});
```

### 4. Bot Integration
```typescript
import { Bot } from 'grammy';

const bot = new Bot(process.env.BOT_TOKEN!);

// Launch Mini App from bot
bot.command('start', (ctx) => {
  ctx.reply('Welcome to x402-TON!', {
    reply_markup: {
      inline_keyboard: [[{
        text: 'Open App',
        web_app: { url: MINI_APP_URL }
      }]]
    }
  });
});

// Deep linking: /start?startapp=demo
bot.command('demo', (ctx) => {
  ctx.reply('Watch AI agents pay for services:', {
    reply_markup: {
      inline_keyboard: [[{
        text: 'Live Demo',
        web_app: { url: `${MINI_APP_URL}/agent-demo` }
      }]]
    }
  });
});
```

### 5. Telegram-Specific UX
- **Haptic Feedback**: `miniApp.hapticFeedback.impactOccurred('medium')`
- **Theme Sync**: Use `--tg-theme-*` CSS variables
- **Main Button**: Use Telegram's native bottom button for primary actions
- **Popup/Alert**: Use Telegram's native popups for confirmations
- **Cloud Storage**: Persist user preferences across sessions

## Key Considerations
- Mini App must work within Telegram's WebView constraints
- No localStorage on some platforms — use CloudStorage
- Test on both iOS and Android Telegram clients
- Handle Telegram's back button vs browser navigation
- Respect safe areas (notch, bottom bar)

## Collaboration
- Works with **Frontend Lead** on React architecture
- Works with **UI/UX Designer** on Telegram theme integration
- Works with **Backend Engineer** on bot commands
- Provides TMA utilities to all frontend developers

## Testing
- Use @nicegram/ngbot or Telegram's @BotFather test environment
- Test deep linking flows
- Verify TON Connect works on mobile wallets (Tonkeeper, MyTonWallet)
