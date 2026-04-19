# Trade Reflection - Local Development

Run BOTH of these in separate terminals:

## Terminal 1: Backend (Express server)
```bash
npm run server
```
Starts on `http://localhost:3001`
Handles: `/api/ai/*`, `/api/yahoo/*`

## Terminal 2: Frontend (Vite dev server)
```bash
npm run dev
```
Starts on `http://localhost:5173`
Proxies API calls to localhost:3001 (see vite.config.ts)

Then visit: http://localhost:5173/auth/login
