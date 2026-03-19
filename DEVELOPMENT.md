# Development Guide

## Project Structure

**Frontend:** React + TypeScript + Vite  
**Backend:** Express.js + Prisma + MySQL

---

## Development Workflow

### Starting the Frontend Dev Server

From the **root** folder:

```bash
npm run dev
```

Starts Vite development server on `http://localhost:5173` with hot module replacement (HMR).

- Changes to `.tsx` and `.css` files refresh instantly
- Compiled files are served in-memory (not written to disk)

### Starting the Backend API Server

From the **server** folder:

```bash
cd server
npm run dev
```

Starts Express API on `http://localhost:4000` with nodemon auto-reload.

- Changes to `.js` files in `src/` trigger automatic restart
- API listens on `http://localhost:4000`
- Logs requests and errors to console

**Convenience:** From root, you can also run:
```bash
npm run server:dev
```

### Running Both in Separate Terminals

**Terminal 1 (Frontend):**
```bash
npm run dev
# Vite starts on http://localhost:5173
```

**Terminal 2 (Backend):**
```bash
cd server
npm run dev
# Express starts on http://localhost:4000/api
```

The frontend is configured to connect to the backend API at `http://localhost:4000/api` (see `.env`).

---

## Database Setup (One-time)

```bash
cd server

# Create and apply database schema
npm run prisma:migrate -- --name init

# Populate seed data from JSON files
npm run db:seed
```

After seeding, the database contains sample admins, vehicles, transactions, and expenses.

---

## Building for Production

From the **root** folder:

```bash
npm run build
```

This:
1. Compiles React code with optimizations
2. Generates static files
3. Outputs to `server/public/`

### Serving the Production Build

```bash
cd server
npm run start
```

The server now:
- Serves the static frontend from `server/public/`
- Serves the API on `/api` routes
- Runs on `http://localhost:4000` (single origin)

---

## Configuration

### Frontend Environment (`.env`)
```
VITE_API_URL=http://localhost:4000/api
```

Controls where the frontend sends API requests. Update this if deploying to a different server URL.

### Backend Environment (`server/.env`)
```
DATABASE_URL=mysql://user:pass@localhost:3306/paypark
PORT=4000
NODE_ENV=development
```

---

## API Endpoints

Available during development or production:

- `POST /api/auth/login` — Admin login
- `GET /api/settings` — Get kiosk settings
- `PATCH /api/settings` — Update settings
- `GET /api/vehicles` — List vehicles
- `PATCH /api/vehicles/:id` — Update vehicle
- `GET /api/transactions` — List transactions with pagination
- `POST /api/transactions` — Record new transaction
- `GET /api/expenses` — List expenses
- `POST /api/expenses` — Create expense
- `GET /api/health` — Health check

---

## Debugging

### Frontend
- Open browser DevTools (`F12`)
- Network tab shows all API calls to `localhost:4000/api`
- Console shows React component errors
- Use React DevTools browser extension for state inspection

### Backend
- Check Express console output for request logs
- Errors and stack traces appear in the terminal where you ran `npm run dev`
- Use `console.log()` in controllers to debug logic

### Database
```bash
cd server
npm run prisma:studio
```
Opens Prisma Studio (GUI) to view and edit database records directly.

---

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 4000 (backend)
Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# Kill process on port 5173 (frontend)
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### Database Connection Error
```
Error: connect ECONNREFUSED localhost:3306
```
Ensure MySQL is running and `DATABASE_URL` in `server/.env` is correct.

### API Not Responding
1. Check if Express is running on `http://localhost:4000/api/health`
2. Verify `VITE_API_URL` in root `.env` matches your backend port
3. Check for CORS errors in browser console

---

## Next Steps

1. **Run dev servers** in two terminals
2. **Test login** with seed credentials (see `server/scripts/seed.js`)
3. **Record transactions** in the kiosk view
4. **Check DevTools Network** tab to see API calls
5. **Verify persistence** by reloading the page (data should persist in MySQL)

Happy developing! 🚀
