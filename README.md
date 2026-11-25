# Patient Management System

A full-stack patient dashboard backed by a Flask REST API. Patient records and status decisions are owned by the API; the Angular app sends only patient input fields and displays the returned status.

## Project structure

- `backend/` — Flask, Flask-RESTX, SQLAlchemy, Alembic and Poetry
- `frontend/` — Angular standalone components, Bootstrap and ng-bootstrap
- `docker-compose.yml` — local, persistent Docker setup for both applications

## Requirements

- Python 3.10+
- Poetry 2.x
- Node.js 20.19+ and npm
- Docker with Docker Compose (optional)

## Run locally

### Backend

```powershell
cd backend
poetry install
Copy-Item .env.example .env
poetry run alembic upgrade head
poetry run flask --app "app:create_app()" run --debug --port 5000
```

The default SQLite database is stored in `backend/instance/patients.db`. `DATABASE_URL` can point to another SQLAlchemy database URL. `FRONTEND_ORIGINS` is a comma-separated list of allowed browser origins; it defaults to both `http://localhost:4200` and `http://127.0.0.1:4200`.

Interactive API documentation: [http://localhost:5000/swagger](http://localhost:5000/swagger). The OpenAPI document is served at `/swagger.json`.

### Frontend

```powershell
cd frontend
npm ci
npm start
```

Open [http://localhost:4200](http://localhost:4200). The API base URL is defined in `src/environments/environment.ts`. Production builds use `environment.prod.ts`; in Docker, nginx proxies `/api/*` to the backend's root API routes and `/swagger*` to Swagger, leaving Angular routes such as `/patients/:id` available to the SPA.

## Tests and build

```powershell
cd backend
poetry run pytest
```

```powershell
cd frontend
npm run build
```

The backend tests cover status-rule precedence, CRUD behavior, validation, batch partial success, and Swagger availability.

## Database migrations

Run migrations from `backend/`:

```powershell
poetry run alembic upgrade head
```

The initial `patients` table migration is in `backend/migrations/versions/`. For a schema change, update the SQLAlchemy model and generate a revision with `poetry run alembic revision --autogenerate -m "describe change"`, then review the generated migration before applying it.

## Docker

From the project root:

```powershell
docker compose up --build
```

Open the dashboard at [http://localhost:4200](http://localhost:4200) and Swagger at [http://localhost:4200/swagger](http://localhost:4200/swagger). Docker Compose runs Alembic migrations when the backend starts and stores SQLite data in the named `patient-data` volume. The frontend nginx proxy keeps API requests same-origin in the browser.

To stop the apps, press `Ctrl+C` and run `docker compose down`. The named database volume is retained.

## API behavior and assumptions

- All datetimes are accepted as ISO 8601. Naive input is treated as UTC; offset-aware input is converted to UTC. The API returns naive UTC strings.
- `POST /patients` rejects a client-supplied `id`. `PUT /patients/<id>` replaces the five input fields; omitted optional fields become `null`.
- The status engine stores failing records rather than rejecting them. It checks age, name, future check date, urgent notes, then the pending default, in that order. Client-provided status is ignored.
- `POST /patients/upsert-batch` returns separate `success` and `failed` lists and continues after item-level validation or database failures.
- The list endpoint returns every patient in ascending ID order. Search and five-per-page pagination are client-side, as allowed by the specification.
- The navigation summary uses a shared RxJS `BehaviorSubject` in `PatientService`; successful API responses update it immediately after create, edit, or delete, with no polling or component input/output wiring.
- The create/edit form allows an empty name because the API explicitly treats it as valid input that receives status `Failed`; it does not duplicate business status rules.
- The UI uses a native browser confirmation before deletion to avoid an additional modal dependency.
