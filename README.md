# Baytoti (بيتوتي) — Backend API

Backend for **Baytoti**, a homemade Oriental food ordering platform built for the Syrian market. One NestJS API serves both a **Flutter mobile app** and a **Flutter operations dashboard**.

Solo project by **Amna Dakka** (~2022). Designed for home kitchens selling Aleppine / Eastern dishes — instant orders, large feasts, and family meal delivery — without a payment gateway. Ops get Telegram alerts; customers get FCM push updates as the order moves.

---

## Why this project

Payment rails were not a fit for the local market, so reliability came from a clear order lifecycle, ops alerts, and push notifications instead of checkout SDKs. The API was shaped as a **multi-kitchen marketplace**: one cart can become several kitchen-scoped orders, each with its own status trail.

---

## Highlights

- **Dual-client API** — mobile and dashboard routes for catalog, orders, kitchens, and notifications
- **Order lifecycle** — معلقة → مقبولة → جاري التحضير → جاهز للتوصيل → تم التوصيل, plus cancel / reject paths
- **Multi-kitchen checkout** — baskets, per-item notes, geo location, region, delivery window
- **Telegram ops alerts** — new / canceled / delivered orders ping the kitchen team in real time
- **Firebase Cloud Messaging** — Arabic status pushes to the customer’s device + in-app notification history
- **Cloudinary media pipeline** — multipart image (and video) upload; CDN URLs on catalog entities
- **Catalog & offers** — meals with cook time, units, ingredients, availability, percentage discounts
- **Aggregated home feed** — single `/home` payload (offers + categories + recent meals)
- **Reorder** — rebuild a past basket, recalculate live prices, accept / reject new price
- **Reviews** — confirm receipt, then rate speed / cleanliness / taste
- **Storefront switch** — remote open / close flag for the app
- **Swagger** — `/api-docs` with DTO validation (`class-validator` + global `ValidationPipe`)

---

## Architecture

```
Flutter Mobile App  ──┐
                      ├──► NestJS (Fastify) ──► MongoDB
Flutter Dashboard   ──┘         │
                                ├── Telegram Bot API   (ops alerts)
                                ├── Firebase Admin     (FCM push)
                                └── Cloudinary         (media CDN)
```

Deployed on a **VPS**. Served **3 home kitchens** as a live multi-kitchen catalog.

**Domain modules:** `user`, `kitchen`, `meal`, `category`, `ingredient`, `unit`, `discount`, `region`, `order`, `order-status`, `review`, `notification`, `telegram-bot`, `cloudinary`, `app-status`.

---

## Order flow

1. Client `POST /order` with user, delivery window, region / location, and one or more kitchen baskets.
2. Each kitchen basket becomes an order with a generated `uniqueId` and status **معلقة**.
3. Backend persists orders, Telegram-pings ops, stores a dashboard notification, and sends FCM “pending review” to the customer.
4. Dashboard updates status via `/order/dashboard/orderStatus/:id` → FCM + optional in-app notification.
5. Customer can cancel (while pending), confirm receipt, then leave a review.
6. Reorder recalculates prices from current meal data before re-submitting.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js (≥18) |
| Framework | NestJS 9 + Fastify |
| Language | TypeScript |
| Database | MongoDB + Mongoose |
| Clients | Flutter (mobile + dashboard) |
| Auth | Phone + password MVP login; FCM token stored on user |
| Validation | class-validator / class-transformer |
| Docs | Swagger (`@nestjs/swagger`) |
| Integrations | Telegram Bot API, Firebase Cloud Messaging, Cloudinary |
| Config | `@nestjs/config` + environment variables |
| Hosting | VPS |

---

## Main API surfaces

### Mobile
- `POST /user`, `POST /user/login` — register / login (stores FCM token)
- `GET /home` — offers, categories, recent meals
- `GET /constant` — regions, categories, units, ingredients, order statuses
- `GET /meal/*`, `GET /kitchen/*` — catalog
- `POST /order` — place order(s)
- `PATCH /order/cancel/:id`, `PATCH /order/receive/:id`, `POST /order/review/:id`
- `GET /order/user/:id` — order history
- `POST /reorder`, `PATCH /reorder/:id/:status`
- `GET /notification/user/:id`

### Dashboard
- `GET /order/dashboard/all`, `GET /order/dashboard/:id`, `GET /order/dashboard/uniqueId/:id`
- `PATCH /order/dashboard/orderStatus/:id`
- Meals / kitchens under `*/dashboard/*`
- `GET /notification/dashboard`
- `POST /cloud/image`, `POST /cloud/video`
- `GET|PATCH /app-status`

---

## Design decisions

1. **No payment integration by design** — market constraint; fulfillment reliability from Telegram ops alerts + dashboard status control.
2. **Split orders by kitchen** — supports a multi–home-cook marketplace in one cart.
3. **Status entities** — Arabic-named statuses in MongoDB, looked up for transitions and notification copy.
4. **Push + in-app history** — FCM for immediacy; notification documents for history screens.
5. **Simple auth for MVP** — phone + password to ship; JWT / OTP flows were explored but not required for launch.
6. **Secrets via env** — MongoDB, Telegram, Cloudinary, and Firebase credentials stay out of the repo.

---

## Local setup

```bash
cp .env.example .env
# fill in MongoDB, Telegram, Cloudinary, and Firebase path
npm install
npm run start:dev
```

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/api-docs`

Place your Firebase service account JSON **outside the repo** (or in a gitignored path) and point `GOOGLE_APPLICATION_CREDENTIALS` at it.

---

## Scope

This repository is the **backend API** only. The Flutter mobile app and Flutter dashboard are separate clients that consume these endpoints.

---

## Author

**Amna Dakka** — Backend / API (solo)
