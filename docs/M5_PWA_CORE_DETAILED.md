# M5 PWA Core - Detailed Implementation Guide

## 1. Service Worker with Cache Strategies

### What It Does
A Service Worker is a JavaScript file that runs in the background of your browser, separate from the web page. It intercepts network requests and decides whether to serve cached data or fetch fresh data from the server.

### Why Implement It

| Benefit | Why It Matters |
|---------|----------------|
| **Offline Support** | Users can view trades, journal entries, and previous data without internet connection |
| **Faster Load Times** | Cached assets (JS, CSS, images) load instantly from service worker instead of network |
| **Reduced Data Usage** | Mobile users don't re-download the same assets repeatedly |
| **Resilience** | App continues working if server is slow or temporarily unavailable |
| **Background Sync** | Queue API requests (like trade creation) when offline, sync when back online |

### Specific Cache Strategies to Implement

#### Strategy 1: Cache-First (for static assets)
```javascript
// Files: app.js, styles.css, favicon, fonts
// Cache these FIRST, fallback to network if not in cache

// WHAT TO CACHE:
- JavaScript bundle: app-[hash].js
- CSS bundle: app-[hash].css  
- Image assets: icons, favicons
- Fonts: JetBrains Mono, DM Sans, Bebas Neue
- Index.html (with fallback to cache for offline)

// WHY:
- These files change only when you deploy (new version)
- No need to fetch from server if cached version exists
- Instant load times after first visit
```

#### Strategy 2: Network-First (for API calls)
```javascript
// Requests: /api/trades, /api/profile, /api/journals
// TRY network FIRST, fallback to cache if offline

// WHAT TO CACHE:
- GET requests to /api/trades (for viewing trades offline)
- GET requests to /api/journals (for viewing journal entries offline)
- GET requests to /api/profile (user settings)
- GET requests for stock prices (with timestamp)

// WHY:
- Users need fresh data (trade data changes)
- If offline, show cached version from last sync
- When back online, fetch latest data
- Prevents stale data from being displayed as current

// EXAMPLE:
User creates a trade while online → Service worker caches it
User goes offline → Can still view that cached trade
User goes back online → Fetch latest trades from server
```

#### Strategy 3: Stale-While-Revalidate (for semi-static data)
```javascript
// Data that's relatively static but should update periodically
// SERVE cached version immediately, fetch fresh in background

// WHAT TO CACHE:
- Sector list (Yahoo Finance data)
- Strategy tags
- User's profile picture
- Last 30 days of trades (for dashboard heatmap)

// WHY:
- User sees data instantly (doesn't wait for network)
- Fresh data fetches in background silently
- No "loading spinner" for semi-static content
- Good user experience: fast + up-to-date
```

### Cache Configuration Values

```javascript
// Cache names (version each when you update)
const CACHE_VERSION = 'v1'; // Increment to v2, v3 on deployment
const STATIC_CACHE = `stonk-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `stonk-dynamic-${CACHE_VERSION}`;
const API_CACHE = `stonk-api-${CACHE_VERSION}`;

// What to pre-cache on service worker install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app-[hash].js',      // Your bundled React app
  '/app-[hash].css',     // Your Tailwind CSS
  '/favicon.svg',
  '/fonts/JetBrains-Mono.woff2',
  '/fonts/DM-Sans.woff2',
  '/fonts/Bebas-Neue.woff2'
];

// Cache limits (to prevent storage overflow)
const CACHE_LIMITS = {
  api: 50,              // Keep last 50 API responses
  trades: 100,          // Cache up to 100 trades
  images: 30            // Cache up to 30 images
};

// Cache expiration (when to consider cache stale)
const CACHE_EXPIRY = {
  api: 60 * 60 * 1000,           // 1 hour
  trades: 24 * 60 * 60 * 1000,   // 1 day
  assets: 30 * 24 * 60 * 60 * 1000 // 30 days (only update on deploy)
};
```

### Example Service Worker Cache Logic

```typescript
// Trade creation while offline
if (navigator.onLine) {
  // Online: Send to server immediately
  await createTrade(tradeData);
} else {
  // Offline: Store locally + queue for sync
  await saveToIndexedDB('pending_trades', tradeData);
  showNotification('Trade saved offline. Will sync when online.');
}

// When connection restored:
window.addEventListener('online', async () => {
  const pendingTrades = await getFromIndexedDB('pending_trades');
  for (const trade of pendingTrades) {
    try {
      await createTrade(trade);
      await removeFromIndexedDB('pending_trades', trade.id);
    } catch (error) {
      // If sync fails, keep in queue
      console.error('Sync failed, will retry', error);
    }
  }
});
```

---

## 2. Web App Manifest

### What It Does
A `manifest.json` file tells the browser how to install your app on the home screen. It defines the app name, icons, colors, and launch behavior.

### Why Implement It

| Benefit | Why It Matters |
|---------|----------------|
| **Installable** | Users can add app to home screen (Android, iOS, Windows) |
| **App-Like Experience** | Launches fullscreen, hides browser UI, feels like native app |
| **Branded Icons** | Custom app icons instead of browser favicon |
| **Splash Screen** | Shows branded splash while app loads |
| **Discoverability** | Browsers recognize it as installable web app |

### Specific Values for StonkJournal

```json
{
  "name": "StonkJournal - Trading Journal",
  "short_name": "StonkJournal",
  "description": "AI-powered trading journal for tracking trades, performance, and patterns",
  
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  
  "theme_color": "#0a0e1a",        // Dark theme color
  "background_color": "#0a0e1a",   // Splash screen background
  
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512", 
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-maskable-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png", 
      "purpose": "maskable"
    }
  ],
  
  "categories": ["finance", "productivity"],
  "screenshots": [
    {
      "src": "/screenshots/dashboard.png",
      "sizes": "540x720",
      "type": "image/png"
    },
    {
      "src": "/screenshots/trades.png",
      "sizes": "540x720",
      "type": "image/png"
    }
  ],
  
  "orientation": "portrait-primary"
}
```

### Why Each Field Matters

#### `name` & `short_name`
```
"name": "StonkJournal - Trading Journal"  
// Full name, used in app stores and install dialog
// Should be descriptive and brand-recognizable

"short_name": "StonkJournal"
// Used on home screen where space is limited
// Maximum 12 characters recommended
```

**Reason**: Users need to know what they're installing. Full name is clear, short name fits on home screen.

---

#### `display: "standalone"`
```
Options:
- "standalone" → Full screen, looks like native app (RECOMMENDED)
- "fullscreen" → Hides all browser UI (for games/videos)
- "minimal-ui" → Shows address bar and back button
- "browser" → Opens in normal browser tab
```

**Reason**: For a productivity app like trading journal, `standalone` gives the best experience. It removes browser chrome and feels like a real app.

---

#### `theme_color` & `background_color`
```json
"theme_color": "#0a0e1a",        // Dark gray/black theme
"background_color": "#0a0e1a"    // Same as theme
```

**Reason**: 
- `theme_color`: Colors the browser address bar and system UI to match your app
- `background_color`: Shows while app loads (splash screen)
- Using dark theme (`#0a0e1a`) matches your existing design

---

#### Icons (Multiple Sizes)

```json
"icons": [
  {
    "src": "/icons/icon-192.png",
    "sizes": "192x192",
    "type": "image/png",
    "purpose": "any"           // For home screen
  },
  {
    "src": "/icons/icon-512.png",
    "sizes": "512x512",
    "type": "image/png", 
    "purpose": "any"           // For splash screen / larger displays
  },
  {
    "src": "/icons/icon-maskable-192.png",
    "sizes": "192x192",
    "type": "image/png",
    "purpose": "maskable"      // Adaptive icons (Android 8+)
  },
  {
    "src": "/icons/icon-maskable-512.png",
    "sizes": "512x512",
    "type": "image/png",
    "purpose": "maskable"
  }
]
```

**Why multiple icons?**
- **192x192**: Standard Android home screen icon
- **512x512**: Used for splash screen, app stores, larger displays
- **maskable**: Adaptive icons that follow Android's shape cutout (modern phones)

**Icon Design Requirements**:
```
- Solid backgrounds (transparency won't work on home screen)
- Center logo/content (maskable icons may be cropped)
- For maskable: keep logo within center circle
- High contrast against dark background (#0a0e1a)
- PNG format, RGB color space
```

---

#### `start_url`
```json
"start_url": "/"
```

**Reason**: When user taps the home screen icon, load from root. If you had multiple entry points (e.g., `/dashboard`), you could specify that here.

---

#### `categories`
```json
"categories": ["finance", "productivity"]
```

**Reason**: Helps app stores categorize your app correctly. Users browsing "Finance" apps will find it.

---

## 3. Install Prompt & Button

### What It Does
Triggers the "Add to Home Screen" prompt and provides a UI button for users to install.

### Why Implement It

| Benefit | Why It Matters |
|---------|----------------|
| **User Discovery** | Many users don't know they can install web apps |
| **Explicit CTA** | Button makes it obvious and easy |
| **Higher Install Rate** | Timely prompt increases adoption |
| **Conversion** | More home screen shortcuts = more active users |

### Implementation Details

#### Detecting Install Eligibility
```typescript
// Criteria before showing install button:
// ✅ HTTPS enabled
// ✅ Service worker registered
// ✅ manifest.json valid
// ✅ Icons 192x192 and 512x512 present
// ✅ User not on already-installed app
// ✅ Can only prompt once per 3 months (browser limit)

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();  // Prevent browser's default behavior
  installPrompt = e;   // Save for later
  showInstallButton(); // Show your custom button
});
```

#### Custom Install Button Logic
```typescript
async function handleInstallClick() {
  if (!installPrompt) return;
  
  // Trigger the browser's install dialog
  installPrompt.prompt();
  
  // Wait for user decision
  const { outcome } = await installPrompt.userChoice;
  
  if (outcome === 'accepted') {
    // User accepted - hide button
    hideInstallButton();
    // Optional: track in analytics
    analytics.trackEvent('app_installed');
  } else {
    // User dismissed - ask again later
    console.log('User dismissed install');
  }
  
  installPrompt = null; // Reset for next time
}

// iOS doesn't support beforeinstallprompt, show instructions instead
function showIOSInstallInstructions() {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
    showModal({
      title: 'Install StonkJournal',
      body: '1. Tap Share\n2. Tap "Add to Home Screen"\n3. Tap "Add"'
    });
  }
}
```

#### When to Show the Button
```typescript
const INSTALL_PROMPT_CONFIG = {
  showAfter: 5000,           // Show after 5 seconds of app use
  minSessionTime: 30000,     // Only if user spent 30s+ on app
  notBeforeDays: 3,          // Don't show again for 3 days if dismissed
  maxShowCount: 3            // Show maximum 3 times
};

function shouldShowInstallPrompt(): boolean {
  const lastDismissed = localStorage.getItem('install_dismissed_at');
  const daysSinceDismiss = (Date.now() - parseInt(lastDismissed)) / (1000 * 60 * 60 * 24);
  
  if (lastDismissed && daysSinceDismiss < INSTALL_PROMPT_CONFIG.notBeforeDays) {
    return false; // Too soon to show again
  }
  
  return sessionDuration >= INSTALL_PROMPT_CONFIG.minSessionTime;
}
```

#### Install Button UI
```jsx
// Location: Top banner or bottom sheet
<InstallPromptButton 
  onClick={handleInstallClick}
  label="Install App"
  icon={<DownloadIcon />}
  visible={showInstallPrompt}
/>

// iOS Instructions Modal
{isIOS && !appInstalled && (
  <Dialog>
    <DialogTitle>Add to Home Screen</DialogTitle>
    <DialogBody>
      <ol>
        <li>Tap the Share button at the bottom</li>
        <li>Scroll and tap "Add to Home Screen"</li>
        <li>Tap "Add" to confirm</li>
      </ol>
    </DialogBody>
  </Dialog>
)}
```

---

## 4. Cache Versioning & Updates

### What It Does
Manages different versions of cached files. When you deploy new code, the service worker updates the cache so users get the latest version.

### Why Implement It

| Benefit | Why It Matters |
|---------|----------------|
| **Automatic Updates** | Users get new features without manual action |
| **No Stale Code** | Old buggy code doesn't linger in user cache |
| **Gradual Rollout** | Can deploy in phases if needed |
| **Prevents Corruption** | Old and new versions don't mix |
| **Storage Cleanup** | Old caches automatically removed |

### Specific Versioning Strategy

#### Version Structure
```javascript
// Use build version from package.json
const APP_VERSION = '1.3.0';           // From package.json
const CACHE_VERSION = 'v1.3.0';        // Matches app version

const STATIC_CACHE = `stonk-static-${CACHE_VERSION}`;
const API_CACHE = `stonk-api-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `stonk-dynamic-${CACHE_VERSION}`;

// Old versions to clean up
const CACHE_KEYS = [
  `stonk-static-v1.3.0`,
  `stonk-api-v1.3.0`,
  `stonk-dynamic-v1.3.0`
];
```

**Why this pattern?**
- Cache name changes when version changes
- Browser automatically fetches new files (different cache name)
- Old caches remain until cleanup runs
- Users get gradual migration, not sudden break

---

#### Installation & Activation Flow

```typescript
// Service Worker lifecycle

// 1. INSTALL: Cache static assets on first load
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // Pre-cache essential files
      return cache.addAll([
        '/',
        '/index.html',
        '/app.js',
        '/app.css',
        '/favicon.svg'
      ]);
    }).then(() => {
      self.skipWaiting(); // Activate immediately
    })
  );
});

// 2. ACTIVATE: Clean up old cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !CACHE_KEYS.includes(name))
          .map((name) => {
            console.log(`Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => {
      self.clients.claim(); // Take control of all pages
    })
  );
});

// 3. FETCH: Serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Static assets: cache-first
  if (isStaticAsset(event.request.url)) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
  
  // API calls: network-first
  if (isAPIRequest(event.request.url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful responses
          if (response.ok) {
            caches.open(API_CACHE).then((cache) => {
              cache.put(event.request, response.clone());
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(event.request);
        })
    );
  }
});
```

---

#### Deployment Process

```bash
# 1. Increment version in package.json
npm version minor  # Increases version: 1.3.0 → 1.4.0

# 2. Build creates new hash for bundle files
npm run build
# Output: app-a1b2c3d4.js (hash changes)

# 3. Service worker detects new version in index.html
# Old cache (v1.3.0) and new cache (v1.4.0) coexist briefly

# 4. User revisits site
# Service worker sees new CACHE_VERSION constant
# Fetches fresh app-a1b2c3d4.js into new cache

# 5. Old cache (v1.3.0) cleaned up during activation
# User now running latest version
```

---

#### Update Detection & Notification

```typescript
// In your React app, check for updates
async function checkForUpdates() {
  try {
    const response = await fetch('/manifest.json', {
      cache: 'no-cache' // Force fresh manifest
    });
    const newManifest = await response.json();
    const currentVersion = localStorage.getItem('app_version');
    
    if (newManifest.version !== currentVersion) {
      // New version available
      showUpdateNotification({
        message: 'New version available. Reload to update.',
        action: () => window.location.reload()
      });
      
      localStorage.setItem('app_version', newManifest.version);
    }
  } catch (error) {
    console.error('Update check failed:', error);
  }
}

// Check on app startup
useEffect(() => {
  checkForUpdates();
  
  // Check periodically
  const interval = setInterval(checkForUpdates, 60000); // Every minute
  return () => clearInterval(interval);
}, []);

// Listen for service worker updates
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then((registration) => {
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated') {
          // New service worker activated
          showUpdateNotification({
            message: 'App updated successfully!',
            autoClose: true
          });
        }
      });
    });
  });
}
```

---

### Cache Cleanup Strategy

```typescript
// Periodically clean up old API cache entries
async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    
    for (const request of requests) {
      const response = await cache.match(request);
      const cacheDate = new Date(response.headers.get('date'));
      const age = Date.now() - cacheDate.getTime();
      
      // Remove if older than 7 days
      if (age > 7 * 24 * 60 * 60 * 1000) {
        cache.delete(request);
      }
    }
  }
}

// Run cleanup daily
setInterval(cleanupOldCaches, 24 * 60 * 60 * 1000);
```

---

## Summary Table

| Feature | Value | Reason |
|---------|-------|--------|
| **Cache Version** | Match app version (v1.3.0) | Updates automatically on deploy |
| **Static Strategy** | Cache-first | Instant loads, files rarely change |
| **API Strategy** | Network-first | Fresh data, fallback for offline |
| **Cache Limit** | 50-100 items | Prevent excessive storage usage |
| **Cache Expiry** | 1h API, 30d assets | Balance freshness with performance |
| **Manifest Name** | StonkJournal | Clear, user-recognizable |
| **Display Mode** | standalone | App-like experience |
| **Theme Color** | #0a0e1a | Match dark design |
| **Icon Sizes** | 192x192, 512x512 | Cover all device needs |
| **Install Prompt** | After 5 sec use | Non-intrusive, good timing |
| **Cleanup** | On activation | Prevent cache bloat |

---

## Implementation Priority

1. **Phase 1** (Week 1): manifest.json + register service worker
2. **Phase 2** (Week 2): Cache strategies (static + API)
3. **Phase 3** (Week 3): Install prompt + cleanup
4. **Phase 4** (Week 4): Testing, PWA audit, Lighthouse 90+

