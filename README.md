# Secure E-Commerce Engine with Stripe Checkout

A full-stack online store with secure user accounts, a shopping cart that is saved to the user's account, and a checkout that takes payment through **Stripe's test mode (sandbox)** and then adjusts the stock in the database.

Built for **Task 4 – Mini Project: Secure E-Commerce Engine with Checkout Sandbox**.

| Requirement | How it is met |
| --- | --- |
| Secure registration and login with JWT | NestJS auth module issuing signed JWTs (HS256), a global auth guard and an admin role guard |
| Hashed database credentials | Passwords hashed with bcrypt (12 rounds); only the hash is stored |
| Persistent shopping cart | Cart rows stored per user in PostgreSQL; visitors' carts are kept in the browser and merged on login |
| Checkout through a payment sandbox | Stripe Checkout in test mode; only `sk_test_` keys are accepted |
| Inventory adjusted after successful payment | One database transaction deducts stock and marks the order paid, at most once per order |

## Tech stack

- **Backend:** NestJS 12 (TypeScript), Prisma 7, PostgreSQL 17, Stripe SDK, class-validator, Helmet, rate limiting, Swagger
- **Frontend:** React 19 (TypeScript), Vite, React Router
- **Tests:** Vitest and Supertest (backend, against a real test database), Vitest and Testing Library (frontend)
- **Infrastructure:** Docker Compose for PostgreSQL

## How checkout works

```
 Browser                      Backend (NestJS)                        Stripe (test mode)
 ───────                      ────────────────                        ──────────────────
 Cart → "Checkout"  ───────►  POST /api/checkout
                              • reads cart, prices and stock from DB
                              • creates a PENDING order (price snapshot)
                              • creates a Checkout Session      ────►  hosted payment page
 redirected to Stripe ◄─────  returns checkoutUrl
 pays with test card  ─────────────────────────────────────────────►  payment succeeds
 /checkout/success    ◄────────────────────────────────────────────── redirect with session_id
 POST /api/checkout/confirm ► asks Stripe if the session is paid ────►
                              • one transaction: lock order row,
                                deduct stock (only if enough left),
                                mark order PAID, remove items from cart
                              (optional webhook does the same thing)
```

What happens in the edge cases:

- **Confirmed twice** (the success page, a page refresh and the webhook can arrive together): the order row is locked with `SELECT … FOR UPDATE`, so the second confirmation sees `PAID` and does nothing. Stock is deducted only once.
- **Two customers buy the last item:** each stock decrement is a single conditional `UPDATE … WHERE stock >= quantity`. The second buyer's transaction rolls back, their payment is **refunded automatically**, and the order is marked `REFUNDED` with an explanation. A database `CHECK (stock >= 0)` constraint is a second safety net.
- **Customer cancels on the Stripe page:** the Stripe session is expired so it can no longer be paid, and the order becomes `CANCELLED`.
- **Customer closes the tab after paying:** viewing *My orders* checks pending orders with Stripe and completes them. With a webhook configured, this happens immediately.
- **Prices are never trusted from the browser:** totals are calculated on the server from the database, and the order keeps a copy of the name and price that were paid.

## Getting started

Requirements: Node.js 20.19 or newer, Docker, and a free Stripe account.

### 1. Database

```bash
docker compose up -d        # PostgreSQL 17 on localhost:5433
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env`:

- `JWT_SECRET`: a random string of at least 32 characters:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `STRIPE_SECRET_KEY`: your **test** secret key from the [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) → *Developers → API keys* (starts with `sk_test_`)

Then create the tables, add sample data and start the API:

```bash
npm run db:migrate   # applies the migrations
npm run db:seed      # 12 sample products + an admin account
npm run start:dev    # http://localhost:5000/api  (API docs: http://localhost:5000/api/docs)
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

### 4. Try it

1. Add a few products to the cart (no account needed yet).
2. Click **Log in to checkout**, then create an account. Your cart comes with you.
3. Click **Checkout securely** and pay on the Stripe page with card **4242 4242 4242 4242**, any future expiry date, any CVC and any postcode.
4. You land on the success page: the order is **Paid**, the cart is empty and the stock shown in the shop has gone down.
5. Log in as the admin (`admin@shop.test` / `Admin@12345`) and open **Admin** to see the order and the updated stock, or to restock products.

Other [Stripe test cards](https://docs.stripe.com/testing): `4000 0000 0000 9995` is declined, and `4000 0025 0000 3155` requires 3-D Secure authentication.

### Optional: Stripe webhook

Payments are confirmed without a webhook. To also receive Stripe's events (useful if the customer closes the browser right after paying), install the [Stripe CLI](https://docs.stripe.com/stripe-cli) and run:

```bash
stripe listen --forward-to localhost:5000/api/webhooks/stripe
```

Copy the `whsec_…` secret it prints into `STRIPE_WEBHOOK_SECRET` in `backend/.env` and restart the backend. Every webhook request is verified against that secret before it is processed.

## Running the tests

```bash
cd backend
npm test             # unit tests
npm run test:e2e     # 37 end-to-end tests (needs the Docker database running)

cd ../frontend
npm test             # 10 component tests
```

The backend end-to-end tests run against a separate `ecommerce_test` database, created automatically, using a fake payment gateway. They never call Stripe. They cover:

- registration and login, including that passwords are hashed and that a client cannot make itself admin
- cart persistence and stock limits
- admin access
- checkout pricing
- confirming the same payment several times at once
- two customers racing for the last unit
- refunds, cancellations and webhook signature checks

## API overview

All endpoints are under `/api`. Interactive documentation is at **http://localhost:5000/api/docs**.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | – | Create an account, returns `{ token, user }` |
| POST | `/auth/login` | – | Log in, returns `{ token, user }` |
| GET | `/auth/me` | User | Current user |
| GET | `/products`, `/products/:id` | – | Products for sale |
| GET | `/cart` | User | Saved cart with totals |
| PUT | `/cart/items/:productId` | User | Add a product or set its quantity |
| DELETE | `/cart/items/:productId`, `/cart` | User | Remove an item or clear the cart |
| POST | `/cart/merge` | User | Merge a guest cart after login |
| POST | `/checkout` | User | Create a pending order and Stripe Checkout Session |
| POST | `/checkout/confirm` | User | Verify payment with Stripe and deduct stock (idempotent) |
| POST | `/checkout/:orderId/cancel` | User | Cancel a pending order and expire its session |
| GET | `/orders`, `/orders/:id` | User | Order history |
| GET/POST | `/admin/products` | Admin | List all products or create one |
| PATCH/DELETE | `/admin/products/:id` | Admin | Update (restock) or archive a product |
| GET | `/admin/orders` | Admin | All orders with customers |
| POST | `/webhooks/stripe` | Stripe signature | Optional Stripe webhook |

## Security measures

- bcrypt password hashing. A failed login takes the same time whether or not the email exists, so attackers cannot discover which emails have accounts.
- JWTs signed with HS256 only. The user is re-loaded on every request, so a deleted account loses access immediately.
- Every route requires authentication unless it is explicitly marked public. Admin routes also check the role.
- Input validation on every request body. Unknown fields are rejected, so a client cannot set `role` or a price.
- Rate limiting on all routes, and a stricter limit on login and registration.
- Helmet security headers, a CORS allow-list and a JSON body size limit.
- Only Stripe test keys are accepted. Webhooks are verified with their signature.
- Secrets live in `.env`, which is git-ignored; only `.env.example` is committed.

## Project structure

```
├── docker-compose.yml          PostgreSQL for development
├── backend/
│   ├── prisma/                 schema, migrations (with CHECK constraints) and seed
│   ├── src/
│   │   ├── auth/               register, login, JWT
│   │   ├── products/           public catalog and admin management
│   │   ├── cart/               persistent cart
│   │   ├── orders/             checkout, order history, fulfillment, webhook
│   │   ├── payments/           Stripe gateway behind a small interface
│   │   ├── common/             guards, decorators, filters
│   │   └── config/             validated environment variables
│   └── test/                   end-to-end tests and the fake payment gateway
└── frontend/
    └── src/
        ├── auth/, cart/        React context for the session and cart
        ├── pages/              shop, cart, login, checkout, orders, admin
        └── components/         layout, product card, order summary, …
```
