# Frontend to Backend API Integration

## ✅ Migration Complete

The frontend has been fully migrated from the mock in-memory database to the server API.

### What Changed

**Deleted:**
- ❌ `src/app/database/` folder (mockDatabase.ts, seeds.ts, contracts.ts, JSON files)
- ❌ All localStorage-based mock storage

**Created:**
- ✅ `src/app/api/` — API client service
  - `types.ts` — Shared type contracts matching backend Prisma models
  - `client.ts` — HTTP client with methods for all API endpoints

- ✅ `src/app/context/` — Server-backed replacement for DatabaseContext
  - `DatabaseContext.tsx` — Context provider connected to backend API with loading/error states

- ✅ `.env` and `.env.example` — API configuration
  - `VITE_API_URL=http://localhost:4000/api` (development default)

**Updated:**
- 🔄 All component imports now point to `../context/DatabaseContext` instead of `../database/`
- 🔄 vite.config.ts & server/app.js remain integrated for seamless deployment

---

## 🏗️ Architecture

### Frontend Flow
```
Component (e.g., KioskView)
    ↓
useDatabase() Hook
    ↓
DatabaseContext (React Context)
    ↓
apiClient (HTTP Client)
    ↓
Express Server API (http://localhost:4000/api)
    ↓
Prisma + MySQL Database
```

### API Endpoints Used
- `POST /api/auth/login` — Admin authentication
- `GET /api/settings` — Load display settings
- `PATCH /api/settings` — Update settings
- `GET /api/vehicles` — List vehicles
- `PATCH /api/vehicles/:id` — Update vehicle
- `GET /api/transactions` — List transactions with pagination
- `POST /api/transactions` — Record new transaction
- `GET /api/expenses` — List expenses
- `POST /api/expenses` — Create new expense

---

## 🚀 Development & Deployment

### Development Mode
```bash
# Start both frontend dev server + backend with HMR
npm run dev

# In another terminal: just backend
cd server && npm run dev

# In another terminal: just frontend
npm run dev:frontend
```

Frontend dev server: `http://localhost:5173` (Vite)
Backend API: `http://localhost:4000/api`

### Production Mode
```bash
# Build frontend to server/public
npm run build

# Start server (serves frontend + API)
cd server && npm run start

# Access via single origin
http://localhost:4000
```

---

## 🔧 Environment Variables

### Frontend (.env)
```
VITE_API_URL=http://localhost:4000/api
```

**Production override:**
```bash
npm run build
# Then set VITE_API_URL before building if deploying to different URL
```

### Backend (server/.env)
```
DATABASE_URL=mysql://user:pass@localhost:3306/paypark
PORT=4000
NODE_ENV=development
```

---

## 📋 Component Data Flow

### Before (Mock Database)
```
Component → useDatabase() → MockDatabase (localStorage) → seed data
```
- No network latency
- No server dependency
- Static sample data

### After (Server API)
```
Component → useDatabase() → ApiClient → Express Server → MySQL
```
- Real-time data
- Persistent across sessions
- Live updates
- Error handling + loading states

---

## 🔄 Context Changes

### Old API (removed)
```typescript
const db = useDatabase();
db.addTransaction(type, amount);  // Sync
db.updateSettings(patch);          // Sync
```

### New API (server-backed)
```typescript
const db = useDatabase();
await db.addTransaction(type, amount);  // Async
await db.updateSettings(patch);         // Async
db.isLoading       // Loading state
db.error           // Error message
```

**All components updated to handle async operations via `await`.**

---

## ✨ Features

- ✅ Real-time multi-user consistency
- ✅ Persistent data storage
- ✅ Loading spinners + error toasts
- ✅ Automatic data fetching on mount
- ✅ Network error handling
- ✅ Type-safe API calls
- ✅ Server-side validation
- ✅ Password hashing (bcryptjs)

---

## 🧪 Testing the Integration

```bash
# 1. Start server with built frontend
cd server && npm run start

# 2. Open browser
http://localhost:4000

# 3. Try the kiosk
- Click "Admin Access"
- Login with seed data credentials (see server/scripts/seed.js)
- Record transaction
- Check API calls in Network tab

# 4. Verify data persists
- Close browser, reopen
- Data should remain (stored in MySQL)
```

---

## 📚 Related Files

- Backend API: [server/src/routes/](../server/src/routes/)
- Controllers: [server/src/controllers/](../server/src/controllers/)
- Type contracts: [src/app/api/types.ts](./api/types.ts)
- API client: [src/app/api/client.ts](./api/client.ts)

---

## Next Steps

1. Seed the database: `npm run db:seed` (from server/)
2. Test login with admin credentials
3. Record transactions in kiosk view
4. Monitor API calls in browser DevTools Network tab
5. Verify data persistence across page reloads
