# Backend Continuation TODO (Express + Prisma + MySQL)

This checklist is designed so work can continue later even after chat context resets.

## 0) Setup

- [ ] Copy .env.example to .env
- [ ] Set DATABASE_URL for your local MySQL instance
- [ ] Run npm install inside server/
- [ ] Run npm run prisma:generate
- [ ] Run npm run prisma:migrate -- --name init
- [ ] Run npm run dev and verify /api/health

## 1) Shared Utilities

- [x] Add request validation middleware (zod or custom)
- [x] Add async wrapper helper for controllers
- [x] Add centralized response helper (success/error shape)
- [ ] Add logger middleware (request id + timing)

## 2) Auth

Routes: src/routes/auth.routes.js  
Controller: src/controllers/auth.controller.js

- [ ] POST /api/auth/login
- [x] Validate username/password input
- [x] Replace plain password with bcrypt compare against Admin.passwordHash
- [x] Update lastLogin on successful login
- [x] Return safe admin payload without passwordHash

## 3) Settings

Routes: src/routes/settings.routes.js  
Controller: src/controllers/settings.controller.js

- [x] GET /api/settings
- [x] PATCH /api/settings
- [x] Validate prices are non-negative
- [x] Validate openTime/closeTime format HH:mm
- [x] Keep response shape aligned with frontend contracts

## 4) Vehicles

Routes: src/routes/vehicles.routes.js  
Controller: src/controllers/vehicles.controller.js

- [x] GET /api/vehicles
- [x] PATCH /api/vehicles/:id
- [x] Validate id exists
- [x] Validate enabled boolean and allowed priceKey values
- [ ] Add optional bulk update route for reorder/toggle later

## 5) Transactions

Routes: src/routes/transactions.routes.js  
Controller: src/controllers/transactions.controller.js

- [x] GET /api/transactions
- [x] POST /api/transactions
- [x] Add pagination query params (page, limit)
- [x] Add filters (type, status, dateFrom, dateTo)
- [x] Validate amount > 0
- [x] Ensure controlNumber uniqueness
- [x] Sort newest first by timestamp

## 6) Expenses

Routes: src/routes/expenses.routes.js  
Controller: src/controllers/expenses.controller.js

- [x] GET /api/expenses
- [x] POST /api/expenses
- [x] Add pagination and date/category filtering
- [x] Validate amount > 0 and date format

## 7) Seed/Migration Alignment

- [x] Build seed script from src/app/database JSON files
- [x] Map admins.json password to bcrypt hash
- [x] Ensure vehicle priceKey values match frontend contract keys
- [x] Keep sample data deterministic for local testing

## 8) Frontend Integration Path

- [ ] Add API client module in frontend with same shapes as contracts.ts
- [ ] Keep mock adapter as fallback while backend endpoints are incomplete
- [ ] Feature-flag between mock database and live API mode

## 9) Security and Production Hardening (later)

- [ ] Replace open CORS with allowed origins list
- [ ] Add rate limiting for login route
- [ ] Add helmet and trusted proxy setup
- [ ] Add basic audit logs for settings and financial writes

## 10) Tests

- [ ] Add controller unit tests for each resource
- [ ] Add route integration tests (supertest)
- [ ] Add Prisma test database workflow

