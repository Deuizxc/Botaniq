# BotaniQ

A working garden tracking application for CUAI, Quezon City University. Plain HTML, CSS, and JavaScript with a Node.js HTTP server and a persistent SQLite relational database. No npm packages or build step are needed.

## Run locally

1. Install **Node.js 24 or later**.
2. Open a terminal in this folder and run `npm start`.
3. Open **http://localhost:3000**. Do not open `index.html` directly; sign-in and records need the server.
4. On the first run, the terminal prints a randomly generated demo password. Use it with `admin@botaniq.local` (administrator) or `mika@botaniq.local`, `paolo@botaniq.local`, or `sam@botaniq.local` (staff).
5. Use the account button at the top right to change passwords. All seeded people, crops, plots, and tasks are fictional demonstration records.

The initial password is printed **only once** and is not stored in plaintext. Keep it until each account has changed its password. Restarting the server keeps all records and passwords. Press Ctrl+C to stop the server. Set `PORT` if port 3000 is already in use.

## Pages and roles

All HTML routes share `index.html`, `css/style.css`, and `js/script.js`; the server serves the shell at each named route. Navigation and browser back/forward work without duplicate templates.

| Route | Purpose |
| --- | --- |
| `index.html` | Sign-in / role-aware overview |
| `admin-dashboard.html` | Plot overview, today's care list, takeover review |
| `staff-dashboard.html` | Assigned tasks and recent crop history |
| `plot-info.html` | Search and filter plots; append `?id=7` for a plot's details |
| `edit-plot.html?id=7` | Admin plot actions, planting, transplanting, harvest, and staff assignment |
| `tasks.html` | Dated maintenance tasks, assignment, completion, takeover, and weather adjustments |
| `inventory.html` | Crop catalog and new planting cycles |
| `nutrients.html` | Fertilizer / hydroponic nutrient application log |
| `staff.html` | Admin account creation and account activation/deactivation |
| `archive.html` | Admin-only, read-only crop archive |

Administrators can add crops and plots, start/assign/harvest/transplant crop cycles, create and reassign dated tasks (including removal of an assignment), manage account access, and review flagged takeovers. Staff can browse current records, complete their own tasks, take over another staff member's task with a reason, adjust their own watering tasks, and record nutrient applications. All write permissions are enforced on the server.

## Project flows

### Six-week history

`harvest_date IS NULL OR harvest_date >= date(:today, '-42 days')` selects active/recent cycles. `harvest_date < date(:today, '-42 days')` selects archived cycles. The exact cutoff date remains in the recent view. Only admins receive archived records through the API. No background job, row migration, or deletion is needed.

The server computes `today` in **Asia/Manila**, independent of the computer's timezone. The supplied MySQL expression `DATE_SUB(CURDATE(), INTERVAL 6 WEEK)` is represented by SQLite's equivalent `date(:today, '-42 days')`. `cycle_details` is the shared SQL join view. Historical cycles are immutable through the application after harvest; a new planting creates a separate cycle.

### Nursery transplant

An admin selects a live nursery crop and an available outdoor/greenhouse plot. One database transaction updates `current_plot_id`, records today's transplant date, marks the old nursery vacant, and marks the destination occupied. The cycle ID, original plot, crop, planting date, and staff assignment stay intact. Occupied targets, repeated transplants, and harvested cycles are rejected. A unique partial index prevents two live cycles from occupying one plot.

### Takeover and review

A staff member selects another staff member's pending task and supplies a nonblank reason. The server derives the substitute from the signed-in account, preserves the original assignee, completes the task, timestamps it, and raises the admin review flag. The bell on the admin dashboard opens the review list. Marking a takeover reviewed records the reviewer and time; it does not erase the reason or assignees. Completed tasks cannot be completed or taken over again.

### Manual care and nutrients

Watering can be skipped or rescheduled with an explanation. The previous schedule, new schedule, action, staff member, and reason remain in an adjustment log. Extra heat-related watering can be scheduled as an additional dated task. Schedules use Manila time. Future tasks cannot be completed early. Fertilizer and hydroponic nutrient logs retain the application date, product, plot, recorder, and notes. There are no pesticide/insecticide task categories, sensor inputs, SMS/email notifications, or measured consumption claims.

## Files and data

- `server.js`: authentication, authorization, HTTP API, business rules, and transaction handling.
- `schema.sql`: tables, foreign keys, constraints, indexes, and cycle details view.
- `index.html`, `css/style.css`, `js/script.js`: responsive interface, forms, searching, and navigation.
- `test/app.test.js`: integration tests using isolated in-memory databases.
- `data/botaniq.sqlite`: automatically created, persistent local database; excluded from Git and never served over HTTP.

For a consistent backup, stop the server and copy the **entire `data` directory**, including any SQLite WAL files. Keep backups private because they contain user and garden records. Restore only while the server is stopped. Do not delete this folder to fix login issues if it contains records you need.

## Verification

Run `npm test`. Tests exercise the actual HTTP API and database, covering role boundaries, private-file access, the exact six-week cutoff, transaction rollback, origin retention, takeover validation/review, weather history, invalid dates, crop replacement, account deactivation, password changes, session revocation, nutrient categories, and cross-origin write rejection. The test process needs permission to make local loopback HTTP connections.

## Hosting scope

This implementation is a **local, persistent-server application**, bound to `127.0.0.1`. It is not deployed, and is not a drop-in Vercel serverless app: Vercel's ephemeral function filesystem cannot safely hold this SQLite database. For the proposal's Vercel deployment, provision a hosted relational database, migrate the schema/queries and database adapter, and configure server-side secrets before deployment. No cloud credentials have been embedded.

For a persistent-server deployment, use HTTPS via a trusted reverse proxy, enable `COOKIE_SECURE=true`, configure the trusted host/origin behavior, replace demo accounts/data, and provide backups and operational monitoring. The current login rate limit is per process and the app binds only to loopback. Sessions last eight hours and passwords are scrypt-hashed with unique salts. Public production hosting and multi-instance load testing have not been completed.

The approved document is used as product context. Its older row-transfer wording is replaced by the explicitly requested date-filter approach. Task scheduling is explicit per date; no recurring scheduler is introduced.
