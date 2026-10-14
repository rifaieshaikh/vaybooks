# VayBooks

Greenfield migration in progress: **Vite/React MFEs + Redux** and **FastAPI microservices** (combined process for desktop).

**MongoDB Atlas is the source of truth** for business data (per-service DB names on one mongod). CSV/JSON are only for import, export, and backup.

## Quick start (new stack)

```powershell
# API + React shell (from vaybooks/)
pip install -r requirements-api.txt
.\restart_vaybooks.ps1 -Mode Dev
# API only: .\restart_vaybooks.ps1 -Mode Dev -ApiOnly
```

- UI: http://localhost:5173  
- API docs: http://localhost:8000/docs  

See [`docs/architecture-phase0.md`](docs/architecture-phase0.md), [`installer/MIGRATION.md`](installer/MIGRATION.md), [`web/README.md`](web/README.md).

## Architecture (target)

```
React MFEs + Redux → API Gateway → Auth / module services → per-service Mongo
                              ↘ outbox / in-process bus (desktop) or Kafka (web)
```

Domain/application are re-exported from [`packages/reexports`](packages/reexports) (Step A).

## Setup

### 1. Create virtual environment

```bash
python -m venv venv

# Linux/Mac
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r requirements.txt
```

### 2. MongoDB Atlas

1. Create a [MongoDB Atlas](https://www.mongodb.com/atlas) account
2. Create a cluster
3. Create a database user
4. Allow network access (include your IP)
5. Copy the connection string

### 3. Local secrets

Copy the example secrets file and add your credentials:

```bash
cp secrets.toml.example secrets.toml
```

Edit `secrets.toml`:

```toml
MONGODB_URI = "mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority"
MONGODB_DATABASE = "zahcci_customization"
```

**Do not commit `secrets.toml`.**

For CLI scripts (indexes, seed), you can also set environment variables:

```bash
# Windows PowerShell
$env:MONGODB_URI = "mongodb+srv://..."
$env:MONGODB_DATABASE = "zahcci_customization"
```

### 4. Initialize database

```bash
python -m vaybooks.bms.infrastructure.db.indexes
python -m vaybooks.bms.infrastructure.db.seed
```

### 5. Run tests

```bash
pytest tests/
```

### 6. Start the app

```powershell
.\restart_vaybooks.ps1 -Mode Dev
```

- UI: http://localhost:5173
- API docs: http://localhost:8000/docs

## Features

- **Customer Management** — search, create, customer accounts
- **Customization Orders** — multiple bill numbers, measurements, activity checklist
- **Customization Activities** — in-house/outsourced, time tracking, default prices
- **Time Tracking** — record time per bill number and activity
- **Expenses** — auto-calculated from time on activity completion
- **Invoicing** — invoice generation with Margin Per Hour (MPH)
- **Delivery** — mark orders delivered
- **Accounting** — receipts, payments, journal entries, trial balance
- **Reports** — profitability, pending activities, time, expenses, MPH
- **Export / Backup** — CSV exports and full JSON backup

## Workflow

1. Create Customization Order (customer, bills, measurements, activities, advance)
2. Record time against bill numbers for in-house activities
3. Complete activities (expense auto-calculated for time-based work)
4. Order becomes **Ready For Delivery** when all required activities are done/skipped
5. Generate invoice (MPH calculated)
6. Mark delivered

## Tech Stack

- Frontend: React (Vite)
- Backend: Python (FastAPI, DDD)
- Database: MongoDB Atlas
- Driver: PyMongo
