# MongoDB Atlas + Render Deployment Guide

## 1) Create MongoDB Atlas Database

1. Create a free cluster in MongoDB Atlas.
2. Create a database user with username/password.
3. In Network Access, allow either:
   - `0.0.0.0/0` (quick test), or
   - only Render outbound IP ranges (more secure).
4. Copy connection string and replace placeholders:

```text
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/farmersfriend?retryWrites=true&w=majority
```

## 2) Push Code to GitHub

Render deploys from GitHub.

## 3) Deploy on Render (Free Web Service)

Option A: Blueprint
1. In Render dashboard, click New + -> Blueprint.
2. Select your repo.
3. Render reads `render.yaml` automatically.

Option B: Manual web service
1. New + -> Web Service.
2. Select repo.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Environment: Node

## 4) Set Environment Variables on Render

In Render service -> Environment:

- `MONGO_URI` = your Atlas connection string
- `DATA_GOV_API_KEY` = optional (for live crop rate API)

## 5) Verify Deployment

Open:

- `https://<your-render-service>.onrender.com/api/health`

Expected:

- `ok: true`

## 6) Point Frontend/APK to Render URL

Use your Render URL as API base, for example:

```text
https://farmersfriend-api.onrender.com
```

## Notes

- If `MONGO_URI` is not set, the server falls back to local JSON files.
- On Render, local filesystem is ephemeral; use MongoDB Atlas for persistence.
- Free Render services sleep when idle and can take time to wake.
