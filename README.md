# BotaniQ
**Garden tracking and resource management for the Center for Urban Agriculture and Innovation (CUAI), Quezon City University**

![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A5%2020-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

---

## Project Overview

BotaniQ is a database-driven web application for managing the CUAI garden at Quezon City University. It replaces ad hoc notes with a single source of truth for three questions: **what is planted where, who is responsible for it, and what care it needs today.**

The system is deliberately lightweight: a vanilla HTML, CSS, and JavaScript front end served by a small Node.js backend on top of PostgreSQL. There is no front-end framework, no web framework, and no build step, which keeps it easy to run, review, and hand over to future maintainers.

It supports two roles. **Admins** manage plots, crop cycles, tasks, and accounts. **Staff** view the garden, complete assigned tasks, record fertilizer use, and message admins.

> Seeded crops, plots, and tasks are fictional demonstration records.

---

## Key Features

* **Interactive garden map**: 27 numbered plots with zoom, drag and arrow-key panning, and live occupancy. Admins can place, drag, resize, and remove plots directly on the map. Greenhouses open into individual beds that each hold their own crop.
* **Crop cycles**: Start, assign, transplant, and harvest crops. A nursery transplant is a single database transaction, and a partial unique index guarantees only one live crop per plot, even under concurrent requests.
* **Task management**: Dated watering, fertilizer, hydroponic, harvest, and general maintenance tasks. Staff can take over a colleague's task with a required reason, which raises a review flag for admins. Watering tasks can be skipped or rescheduled for weather, with every change written to an audit log.
* **Per-plot history**: Crop records, fertilizer applications, and snapshots of every admin save, searchable with tokens such as `crop:"String beans"`, `fertilizer:none`, and `before:2026-10-01`.
* **Role-aware dashboards**: Staff see their unfinished tasks and a monthly calendar. Admins see daily staff progress and takeover reviews. Open sessions poll for updates every 30 seconds and announce new assignments with toasts.
* **Manila-time scheduling**: The server always computes "today" in `Asia/Manila`, regardless of where it runs.

---

## Visual Showcase

<p align="center">
  <img src="assets/git1.png" width="48%" alt="Landing page" />
  <img src="assets/git2.png" width="48%" alt="Admin dashboard" />
</p>
<p align="center">
  <img src="assets/git3.png" width="48%" alt="Interactive garden map" />
  <img src="assets/git4.png" width="48%" alt="Task management" />
</p>

---

## Technical Architecture

```mermaid
flowchart LR
    Browser["Browser<br/>index.html · css · js"] -->|"fetch /api/*"| Backend["backend.js<br/>auth · rules · API"]
    Backend -->|"pg pool"| DB[("PostgreSQL")]
    Vercel["api/index.js<br/>Vercel function"] --> Backend
```

| Layer | Technology |
| :-- | :-- |
| Front end | Vanilla HTML, CSS, and JavaScript (ES modules), single-page shell |
| Back end | Node.js (`node:http`), no web framework |
| Database | PostgreSQL via [`pg`](https://node-postgres.com/), using the `citext` extension |
| Testing | Node's built-in test runner with in-memory PostgreSQL ([PGlite](https://pglite.dev/)) |
| Hosting | Local Node server or Vercel serverless function |

**Single-page shell.** Every page route (`login.html`, `plot-info.html`, `tasks.html`, and so on) serves the same `index.html`, so navigation and back/forward work without duplicate templates. The client renders each view and talks to a small JSON API: `GET /api/state` returns only the data the signed-in user may see, and `POST` endpoints perform actions such as task and crop-cycle changes.

**Rules in two places.** Business rules such as transplant validity, takeover validation, and early-completion checks live in `backend.js`. The same constraints are duplicated in the database (check constraints, foreign keys, partial unique indexes) as a second line of defense.

**Versioned migrations.** Files in `migrations/` (001 to 007) are applied once each on server start, or on the first API request on Vercel, and tracked in a `schema_migrations` table. Migrations preserve existing plot IDs and history, for example when each greenhouse becomes the container for its first bed.

**Lazy task expiry.** Pending tasks are deleted once they are three calendar days overdue. Cleanup runs on the next authenticated request, so no background scheduler is needed.

---

## Installation and Execution

### Requirements
* [Node.js](https://nodejs.org/) 20 or later
* A PostgreSQL database (local or hosted) where the `citext` extension can be created. The database user needs permission to create and alter tables, because migrations run automatically.

### Run it locally

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

Open **http://localhost:3000**. Do not open `index.html` directly, because sign-in and records require the server.

On first run against an empty database, the app seeds demonstration garden data and demo accounts. Replace the demo accounts and data before any real use.

### Configuration

| Variable | Required | Description |
| :-- | :-: | :-- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | Local server port. Defaults to `3000`. |

### Deploy to Vercel

1. Provision a hosted PostgreSQL database and run `schema.sql` against it.
2. Import the repository into Vercel.
3. Add `DATABASE_URL` as an environment variable.
4. Deploy.

`api/index.js` exposes the backend as a serverless function, and `vercel.json` rewrites `/api/*` to it, maps each page route to `index.html`, and bundles the `migrations/` folder.

---

## Testing

```bash
npm test
```

The suite of about 50 tests runs on Node's built-in test runner against an isolated in-memory PostgreSQL engine (PGlite). It needs no `DATABASE_URL` and never touches a live database. Coverage includes role boundaries, transaction rollback, transplant and takeover validation, account removal, fertilizer completion, migrations, and page routing.

---

## Project Structure

```text
Botaniq/
├── api/index.js       # Vercel serverless entry point
├── backend.js         # HTTP server, API, business rules
├── js/                # script.js (client app), garden.js (map geometry, history filters)
├── css/style.css      # Responsive interface styles
├── migrations/        # Versioned database upgrades (001-007)
├── test/              # accounts, app, garden, and views tests
├── schema.sql         # Base tables, constraints, indexes, cycle_details view
├── index.html         # Single-page application shell
└── vercel.json        # API and page-route rewrites
```

---

