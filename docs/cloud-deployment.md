# Cloud Deployment Guide

VayBooks runs as a combined FastAPI process plus the React shell. Set `MONGODB_URI` and `MONGODB_DATABASE` in the environment.

## Docker (AWS ECS, App Runner, Azure, etc.)

```bash
docker build -t vaybooks .
docker run -p 8000:8000 \
  -e MONGODB_URI="mongodb+srv://..." \
  -e MONGODB_DATABASE="zahcci_customization" \
  vaybooks
```

The API listens on port 8000 (`/health`, `/docs`). Serve the React shell separately, or point the Vite dev proxy at this API with `VAYBOOKS_API_TARGET`.

## AWS App Runner

1. Push the Docker image to ECR
2. Create an App Runner service from the image
3. Set environment variables: `MONGODB_URI`, `MONGODB_DATABASE`
4. Expose port 8000

## Azure App Service

1. Deploy the Docker container or use the Python 3.11 runtime
2. Set Application Settings for `MONGODB_URI` and `MONGODB_DATABASE`
3. Startup command: `python -m services.combined --host 0.0.0.0 --port 8000`

## Runtime Mode Detection

| Variable | Effect |
|----------|--------|
| Not set | Cloud mode — uses secrets file or env |
| `VAYBOOKS_DATA_DIR` set | Desktop mode — uses ProgramData config |

Cloud deployments should **not** set `VAYBOOKS_DATA_DIR`.

## Features by Mode

| Feature | Cloud | Desktop |
|---------|-------|---------|
| Business modules | Yes | Yes |
| Migrations | Yes | Yes |
| Version display | Yes | Yes |
| Export / Backup | Yes | Yes |
| System Settings UI | No | Yes |
| In-app updater | No | Yes |
| Log file viewer | No | Yes |

## CI/CD

Tag releases with `v*.*.*` to trigger the release workflow for desktop installers. Cloud hosts can deploy from the same tag independently.
