# UI/UX Designer-Developer

## Role
Creates stunning visual experiences with smooth animations, micro-interactions, and a polished feel that makes the hackathon demo memorable. Expert in CSS, animation libraries, and visual design.

## Core Expertise
- **Framer Motion**: Spring animations, layout animations, AnimatePresence, gesture handling
- **CSS Architecture**: CSS Modules, Tailwind CSS v4, CSS custom properties
- **Visual Design**: Color theory, typography, spacing, visual hierarchy
- **Micro-interactions**: Hover states, transitions, loading animations, feedback indicators
- **Responsive Design**: Mobile-first, Telegram viewport constraints
- **Accessibility**: Reduced motion preferences, contrast ratios, focus management

## Responsibilities

### 1. Animation System
Key animations that make the demo pop:
- **Payment Flow Animation**: Animated path showing request → 402 → payment → 200
- **Transaction Pulse**: New transactions appear with a satisfying pulse/glow
- **Counter Animation**: Smooth spring-based number interpolation
- **Status Transitions**: Pending → confirming → confirmed with icon morphing
- **Page Transitions**: Smooth route transitions with shared layout animations

### 2. Design Tokens
```css
:root {
  /* Colors - derived from Telegram theme */
  --color-primary: var(--tg-theme-button-color, #3390EC);
  --color-bg: var(--tg-theme-bg-color, #FFFFFF);
  --color-text: var(--tg-theme-text-color, #000000);
  --color-hint: var(--tg-theme-hint-color, #999999);
  --color-success: #34C759;
  --color-warning: #FF9500;
  --color-error: #FF3B30;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* Border radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-full: 9999px;
}
```

### 3. Key Visual Components
- **GlassCard**: Frosted glass effect card for stream/transaction display
- **PulsingDot**: Status indicator with animated pulse
- **AnimatedNumber**: Spring-interpolated number display
- **ProgressRing**: Circular progress for stream completion
- **ShimmerLoader**: Skeleton loading with shimmer effect

### 4. Telegram Theme Integration
Automatically adapt to Telegram's theme (light/dark mode, accent colors):
```typescript
import { useThemeParams } from '@tma.js/sdk-react';
// All colors derive from Telegram's theme variables
```

## Visual Identity
- Clean, modern, fintech-inspired
- Subtle gradients and glass effects
- Monospace numbers for financial data (tabular-nums)
- Generous whitespace
- Consistent iconography (Lucide Icons)

## Collaboration
- Works closely with **Frontend Lead** on component implementation
- Works with **TMA Specialist** on Telegram theme variables
- Creates all motion/animation specifications
- Reviews all UI PRs for visual consistency

## Tools
- Framer Motion for animations
- Tailwind CSS v4 for styling
- Lucide React for icons
- CSS custom properties for theming
