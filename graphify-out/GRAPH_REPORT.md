# Graph Report - Botaniq  (2026-10-23)

## Corpus Check
- 23 files · ~68,370 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 2, .css 1)

## Summary
- 206 nodes · 451 edges · 15 communities (11 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Dashboard and Garden Views
- Product Behavior and Verification
- Backend and Authentication
- Integration Tests and Fixtures
- Database Tables and Constraints
- Garden Calculations and Tests
- Runtime Dependencies
- Forms and API Requests
- Vercel Routing
- Campus Garden Photography
- University Identity
- Editor Project Configuration
- Leaf Favicon
- Test Image

## God Nodes (most connected - your core abstractions)
1. `escape()` - 18 edges
2. `icon()` - 16 edges
3. `dashboard()` - 16 edges
4. `renderPlotInspector()` - 14 edges
5. `renderMain()` - 13 edges
6. `createHandler()` - 12 edges
7. `isAdmin()` - 11 edges
8. `button()` - 11 edges
9. `openForm()` - 11 edges
10. `shell()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Visible workspace notification polling` --semantically_similar_to--> `30 second notification polling`  [INFERRED] [semantically similar]
  docs/redesign-verification.md → README.md
- `fixture()` --calls--> `seedDemo()`  [EXTRACTED]
  test/app.test.js → backend.js
- `Assigned care first` --rationale_for--> `Dated maintenance tasks`  [EXTRACTED]
  docs/redesign-verification.md → README.md
- `fixture()` --calls--> `createApp()`  [EXTRACTED]
  test/app.test.js → backend.js
- `plot_entries` --references--> `crop_cycles`  [EXTRACTED]
  migrations/001-garden-map.sql → schema.sql

## Import Cycles
- None detected.

## Communities (15 total, 4 thin omitted)

### Community 0 - "Dashboard and Garden Views"
Cohesion: 0.17
Nodes (44): badge(), button(), clock(), closeMapPlot(), dashboard(), empty(), escape(), filters() (+36 more)

### Community 1 - "Product Behavior and Verification"
Cohesion: 0.07
Nodes (27): Responsive and accessible layouts, Production deployment untested, Visible workspace notification polling, Local redesign verification, Growing plant loading status, Accessible modal dialog, Garden application shell, Polite live notification region (+19 more)

### Community 2 - "Backend and Authentication"
Cohesion: 0.15
Nodes (20): handler, choice(), createHandler(), mutate(), createRunner(), date(), digest(), fail() (+12 more)

### Community 3 - "Integration Tests and Fixtures"
Cohesion: 0.12
Nodes (7): createApp(), @electric-sql/pglite, accounts, fixture(), login(), request(), testDatabase()

### Community 4 - "Database Tables and Constraints"
Cohesion: 0.25
Nodes (15): plot_entries, plot_entries_history, one_application_per_task, task_messages, crop_cycles, cycle_details, cycle_harvest_date, maintenance_tasks (+7 more)

### Community 5 - "Garden Calculations and Tests"
Cohesion: 0.24
Nodes (14): assignedPending(), calendarMonth(), dateOf(), filterHistory(), latest(), localDate(), mapPosition(), notificationKeys() (+6 more)

### Community 6 - "Runtime Dependencies"
Cohesion: 0.13
Nodes (14): dependencies, pg, devDependencies, @electric-sql/pglite, engines, node, name, private (+6 more)

### Community 7 - "Forms and API Requests"
Cohesion: 0.25
Nodes (14): api(), bindPlotEditor(), field(), getView(), modal(), openForm(), options(), plotOptions() (+6 more)

### Community 8 - "Vercel Routing"
Cohesion: 0.33
Nodes (5): includeFiles, framework, functions, api/index.js, rewrites

### Community 9 - "Campus Garden Photography"
Cohesion: 0.67
Nodes (3): Academic Building, Campus Garden Photograph, Garden Beds and Greenhouses

### Community 10 - "University Identity"
Cohesion: 0.67
Nodes (3): Quezon City University, San Bartolome, Novaliches, Quezon City University banner

## Knowledge Gaps
- **22 isolated node(s):** `Botaniq Serena project`, `TypeScript language server`, `CUAI at Quezon City University`, `PostgreSQL database`, `Vercel serverless deployment` (+17 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 60 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `pg` connect `Runtime Dependencies` to `Backend and Authentication`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `Botaniq Serena project`, `TypeScript language server`, `CUAI at Quezon City University` to the rest of the system?**
  _22 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Product Behavior and Verification` be split into smaller, more focused modules?**
  _Cohesion score 0.07056451612903226 - nodes in this community are weakly interconnected._
- **Why does `@electric-sql/pglite` connect `Integration Tests and Fixtures` to `Runtime Dependencies`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Should `Integration Tests and Fixtures` be split into smaller, more focused modules?**
  _Cohesion score 0.12121212121212122 - nodes in this community are weakly interconnected._
- **Why does `plotOverview()` connect `Garden Calculations and Tests` to `Dashboard and Garden Views`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Should `Runtime Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
## Run limitations

Semantic token usage was not exposed by the agent tools. Zero values in the generated token table are placeholders, not measured zero usage.

Graph health: 5 dangling endpoint edges, 1 self-loop, and 30 undirected same-endpoint collapsed edges. Consult health.json; the graph is useful but not an exhaustive call graph.

graphify-out/ was written into the working tree and is not ignored. Keep it out of deployments; add graphify-out/ to .gitignore or share only intended outputs.
