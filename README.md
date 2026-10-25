<div align="center">

# BotaniQ

**Garden tracking and resource management for the Center for Urban Agriculture and Innovation (CUAI), Quezon City University.**

Plots, crop cycles, and maintenance tasks in one role-aware workspace.

![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A5%2020-339933?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-database-4169E1?logo=postgresql&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript&logoColor=black)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)
![Status](https://img.shields.io/badge/status-pilot-2e7d32)

[Overview](#overview) · [Features](#features) · [Getting Started](#getting-started) · [Deployment](#deployment) · [Architecture](#architecture) · [Security](#security) · [Testing](#testing) · [Roadmap](#roadmap)

</div>

<!-- Add a dashboard screenshot to /assets and uncomment:
<p align="center"><img src="assets/dashboard.png" alt="BotaniQ admin dashboard" width="860"></p>
-->

---

## Overview

BotaniQ is a database-driven web application for managing the CUAI garden at Quezon City University. It replaces ad hoc notes with a single source of truth for three questions: **what is planted where, who is responsible for it, and what care it needs today.**

The system is deliberately lightweight: a vanilla HTML/CSS/JavaScript front end served by a small Node.js HTTP backend on top of PostgreSQL. There is no front-end framework and no build step, which keeps it easy to run, review, and hand over to future maintainers.

> **Note:** Seeded crops, plots, and tasks are fictional demonstration records.

### Who it is for

| Role | Responsibilities in BotaniQ |
| --- | --- |
| **Admin** | Manages plots and crop cycles, schedules and assigns tasks, reviews takeovers and staff messages, creates and removes accounts. |
| **Staff** | Views the garden, completes assigned tasks, records fertilizer use, reports weather-related adjustments, and messages admins. |

Every permission is enforced on the server, not only hidden in the interface.

## Features

**Garden management**

- **Interactive garden map**: 27 numbered plots with zoom, drag/arrow-key panning, an entrance marker, indoor/outdoor styling, and live occupancy. Plots with your unfinished tasks are flagged. A plot picker supports small screens and keyboard navigation.
- **Plot overview and editing**: Each plot shows a photo, description, last watering, last harvest, and current fertilizer. Admins edit plots; staff can view every plot.
- **Crop cycles**: Start, assign, harvest, and transplant crops. A cycle retains its original plot, planting date, and staff assignment for its whole life.
- **Atomic nursery transplants**: Moving a seedling from the nursery to a plot is a single database transaction, and a partial unique index guarantees one live cycle per plot even under concurrent requests.
- **Crop catalog**: Crops are unique by case-insensitive name and variety, with searchable dropdowns.
- **Per-plot history**: Dated crop records, fertilizer applications, and immutable snapshots of every admin save. Search supports free text and tokens such as `crop:"String beans"`, `fertilizer:none`, `before:2026-10-01`, `after:2026-09-01`, and `on:2026-09-20`.

**Task management**

- **Dated maintenance tasks**: Manual watering, fertilizer application, hydroponic nutrients, and general maintenance. Task lists have Assigned, Overdue, and Done views. Tasks cannot be completed early, and overdue tasks cannot be completed or taken over.
- **Task takeover and review**: Staff can take over a colleague's task with a required reason. The original assignee is preserved, and the admin dashboard raises a review flag.
- **Weather adjustments**: Watering tasks can be skipped or rescheduled with an explanation. Every change is written to an audit log, and extra heat-related watering can be added as a new task.
- **Fertilizer records**: Completing a fertilizer or hydroponic task requires a product name and records the application time, plot, and recorder in the same transaction.
- **Private staff messages**: Staff can send task comments to administrators. Message content is returned only to admins.

**Accounts and experience**

- **Role-aware dashboards**: Staff see their unfinished tasks and a monthly calendar of their assignments. Admins see team assignments (excluding their own) with pending totals per staff member.
- **Profiles and accounts**: Users edit their own name, email, and password. Admins create and remove accounts. Removing an account ends access, unassigns pending work and live crops, and retains the person's name on historical records.
- **Notifications**: Toasts confirm actions and announce newly detected assignments or messages. Open sessions poll for updates every 30 seconds.
- **Accessibility and responsiveness**: Verified at 1440, 768, and 390 px widths; transitions respect reduced-motion preferences.
- **Manila-time scheduling**: The server computes "today" in `Asia/Manila` regardless of where it runs.

## Pages and routes

All page routes serve the same single-page shell (`index.html`, `css/style.css`, `js/script.js`), so navigation and browser back/forward work without duplicate templates.

| Route | Purpose | Access |
| --- | --- | --- |
| `index.html` | Campus landing page | Public |
| `login.html` | Sign in | Public |
| `admin-dashboard.html` | Team assignments, care totals, notifications | Admin |
| `staff-dashboard.html` | Assigned unfinished tasks and personal calendar | Staff |
| `plot-info.html` | Garden map, plot overview, searchable history (`?id=7` for details) | Signed in; editing is admin-only |
| `edit-plot.html?id=7` | Planting, transplanting, harvest, and staff assignment | Admin |
| `tasks.html` | Dated tasks, assignment, completion, takeover, weather adjustments | Signed in |
| `inventory.html` | Crop information and new planting cycles | Signed in |
| `staff.html` | Create and remove accounts | Admin |
| `nutrients.html`, `archive.html` | Legacy links kept for compatibility (open tasks and the garden map) | Signed in |

## Tech stack

| Layer | Technology |
| --- | --- |
| Front end | Vanilla HTML, CSS, and JavaScript (ES modules) |
| Back end | Node.js (`node:http`), no web framework |
| Database | PostgreSQL via [`pg`](https://node-postgres.com/) (requires the `citext` extension) |
| Authentication | Scrypt password hashing, server-side sessions, `HttpOnly` cookies |
| Testing | Node's built-in test runner with an in-memory PostgreSQL ([PGlite](https://pglite.dev/)) |
| Hosting | Local Node server or Vercel serverless function |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- A PostgreSQL database (local or hosted) where the `citext` extension can be created

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Deuizxc/Botaniq.git
cd Botaniq

# 2. Install dependencies
npm install

# 3. Point the app at your database
export DATABASE_URL="postgres://user:password@localhost:5432/botaniq"

# 4. Create the base tables (run once)
psql "$DATABASE_URL" -f schema.sql

# 5. Start the server
npm start
```

Open **http://localhost:3000**. Do not open `index.html` directly; sign-in and records require the server.

### Database setup and migrations

`schema.sql` creates the base tables, constraints, indexes, and the `cycle_details` view. It is **not** applied automatically, so run it once before the first start.

Versioned migrations in `migrations/` are applied automatically, once each, on server start (or the first API request on Vercel). Applied migrations are tracked in a `schema_migrations` table. The database user therefore needs permission to create and alter tables.

| Migration | Purpose |
| --- | --- |
| `001-garden-map.sql` | Adds map positions (27 slots), preserves existing plot IDs and crop history, and creates plot history snapshots. |
| `002-accounts.sql` | Adds account-removal tracking. |
| `003-task-care.sql` | Adds private task messages and links fertilizer records to tasks. |
| `004-crop-varieties.sql` | Makes crop uniqueness the trimmed, case-insensitive name and variety pair. |

### Demo data and accounts

On first run against an empty database, the app seeds demonstration garden data and four accounts (one Admin, three Staff) that share the initial password `123`. The credentials are printed to the console on first start, and the seed logic lives in `seedDemo` in `backend.js`.

| Name | Email | Role |
| --- | --- | --- |
| CUIA Admin | `admin@gmail.com` | Admin |

> **Warning:** The shared initial password is insecure. Change it under **Account → Edit profile** immediately, and replace or remove the demo accounts and data before any real use.

Password rules: new passwords must be 8 to 128 characters. Changing your email or password requires your current password and signs out all of your sessions. Password recovery is not implemented; no reset email service is configured.

### Environment variables

| Variable | Required | Description |
| --- | :---: | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string. SSL is enabled automatically unless the URL contains `localhost`. |
| `PORT` | No | Local server port. Defaults to `3000`. |
| `COOKIE_SECURE` | No | Set to `true` behind HTTPS to mark session cookies `Secure`. |

The local server binds to `127.0.0.1` only.

## Deployment

The repository is configured for [Vercel](https://vercel.com/):

- `api/index.js` exposes the backend as a serverless function.
- `vercel.json` rewrites `/api/*` to that function, maps each page route to `index.html`, and bundles the `migrations/` folder with the function.

To deploy:

1. Provision a hosted PostgreSQL database and run `schema.sql` against it.
2. Import the repository into Vercel.
3. Add `DATABASE_URL` as an environment variable.
4. Deploy.

For a persistent-server deployment, run `npm start` behind a trusted HTTPS reverse proxy and set `COOKIE_SECURE=true`. Because the server binds to `127.0.0.1`, the proxy must run on the same host.

## Architecture

```mermaid
flowchart LR
    Browser["Browser<br/>index.html · css · js"] -->|"fetch /api/*"| Backend["backend.js<br/>auth · rules · API"]
    Backend -->|"pg pool"| DB[("PostgreSQL")]
    Vercel["api/index.js<br/>Vercel function"] --> Backend
```

The backend exposes a small JSON API: `GET /api/state` returns the data the signed-in user is allowed to see, and `POST` endpoints perform authenticated actions such as login, logout, and task or crop-cycle changes. Business rules (transplant validity, takeover validation, early-completion checks) live in `backend.js`, with constraints duplicated in the database as a second line of defense.

### Data model

```mermaid
erDiagram
    users ||--o{ sessions : has
    users ||--o{ crop_cycles : "assigned to"
    users ||--o{ maintenance_tasks : "assigned to"
    users ||--o{ nutrient_logs : records
    plants ||--o{ crop_cycles : grown_as
    plots ||--o{ crop_cycles : hosts
    plots ||--o{ maintenance_tasks : needs
    plots ||--o{ nutrient_logs : receives
    plots ||--o{ plot_entries : snapshots
    maintenance_tasks ||--o{ task_adjustments : audited_by
    maintenance_tasks ||--o{ task_messages : receives
    users ||--o{ task_messages : sends
```

`cycle_details` is a shared SQL view that joins each cycle with its plot, crop, origin plot, and assigned staff.

### Key behaviours

- **Nursery transplant**: One transaction updates the cycle's current plot, records the transplant date, marks the nursery plot vacant, and marks the destination occupied. Occupied targets, repeated transplants, and harvested cycles are rejected.
- **Takeover review**: The substitute is derived from the signed-in account. The reason, original assignee, and completion time are retained. Marking a takeover as reviewed records the reviewer and time without erasing anything.
- **History**: Plot history merges crop cycles, fertilizer applications, and snapshots of each admin save. Historical dates without recorded times are labeled accordingly.
- **Scheduling**: Tasks are scheduled explicitly per date. There is no recurring scheduler.

## Security

- Scrypt password hashing with unique salts
- Server-side sessions stored as SHA-256 hashes, valid for eight hours, and revoked on password or email change and on account removal
- `HttpOnly`, `SameSite=Strict` session cookies (`Secure` over HTTPS)
- Cross-origin write rejection, JSON-only request bodies, and a 16 KB request size limit
- Strict Content Security Policy, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: same-origin`
- Sign-in rate limiting (10 attempts per 15 minutes)
- Server-side authorization on every write; private messages are never returned to non-admins

> **Known limitations:** The sign-in rate limiter is per process, so it is not shared across serverless or multi-instance deployments. Multi-instance load testing and public production hosting have not been completed.

## Project structure

```text
Botaniq/
├── api/
│   └── index.js        # Vercel serverless entry point
├── css/
│   └── style.css       # Responsive interface styles
├── docs/
│   └── redesign-verification.md   # Design and verification notes
├── img/                # QCU seal, logo, landing and login imagery
├── js/
│   ├── script.js       # Client app: routing, map, forms, search
│   └── garden.js       # Map geometry, plot facts, history filters
├── migrations/         # Versioned database upgrades (001-004)
├── test/               # accounts, app, garden, and views tests
├── backend.js          # HTTP server, auth, API, business rules
├── index.html          # Single-page application shell
├── schema.sql          # Base tables, constraints, indexes, cycle_details view
├── vercel.json         # API and page-route rewrites
└── package.json
```

## Testing

```bash
npm test
```

The suite runs on Node's built-in test runner against an isolated in-memory PostgreSQL engine (PGlite). It needs no `DATABASE_URL` and never touches a live database. Coverage includes role boundaries, history retention, transaction rollback, transplant origin retention, takeover validation, weather history, profile and password rules, account removal, session revocation, private messages, fertilizer completion, sign-in rate limiting, migrations, plot snapshots, and page and static-asset routing. Helper tests cover map geometry, personal assignments, calendar boundaries, notifications, and history search.

To run a single file:

```bash
node --test test/accounts.test.js
```

## Roadmap

- [x] Integration tests on the PostgreSQL backend
- [ ] Apply `schema.sql` automatically on first start
- [ ] Share the sign-in rate limit across instances
- [ ] Password recovery
- [ ] Screenshots and a hosted demo
- [ ] Production hardening, backups, and monitoring

## Out of scope

BotaniQ deliberately does not include pesticide or insecticide task categories, sensor inputs, SMS or email notifications, or measured resource-consumption claims.

## Contributing

Issues and pull requests are welcome. Please run `npm test` before submitting a change and keep new behavior covered by a test.

## Authors

Built for CUAI, Quezon City University, by [@Deuizxc](https://github.com/Deuizxc) and [@inferism](https://github.com/inferism).

## License

No license has been specified yet. Until one is added, all rights are reserved by the authors. Add a `LICENSE` file to state the terms under which others may use this project.
