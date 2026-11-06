# OpsPilot — DevOps Operations Dashboard

A learning project for React + Flask + MongoDB. It includes service inventory, incident management, deployment history, dashboard metrics, and health endpoints. It is designed to evolve into a Kubernetes practice project.

## Requirements
- Node.js 20+ and npm
- Python 3.11+
- MongoDB running locally, or Docker Desktop

## 1. Start MongoDB
Option A — Docker:
```bash
docker run -d --name opspilot-mongo -p 27017:27017 -v opspilot-mongo-data:/data/db mongo:7
```
If you already have a MongoDB container using port 27017, use that existing database instead.

## 2. Start the backend
Open Terminal in `backend/`:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python app.py
```
Backend: http://localhost:8000
Health: http://localhost:8000/health
Readiness: http://localhost:8000/ready
API: http://localhost:8000/api/summary

## 3. Start the frontend
Open a second Terminal:
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
Frontend: http://localhost:3000

## Useful API endpoints
- `GET /api/summary`
- `GET /api/services` / `POST /api/services`
- `PATCH /api/services/<id>`
- `GET /api/incidents` / `POST /api/incidents`
- `PATCH /api/incidents/<id>`
- `GET /api/deployments` / `POST /api/deployments`
- `GET /health` (process liveness)
- `GET /ready` (checks MongoDB connectivity)

## Notes
- The backend seeds demo data only when each collection is empty.
- Local development uses `.env` files. Do not commit real credentials.
- For Kubernetes practice, we will later move non-sensitive settings to ConfigMaps and credentials to Secrets. Do not put runtime secrets in the Dockerfile or frontend build.
