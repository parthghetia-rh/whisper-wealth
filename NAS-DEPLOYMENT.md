# Deploying WhisperWealth on a NAS (UGREEN / Synology / QNAP)

This guide documents the steps to deploy WhisperWealth on a NAS using Docker, including migrating an existing portfolio database from another machine.

## Prerequisites

- NAS with Docker support (UGREEN NASSync, Synology DSM, QNAP QTS, etc.)
- SSH access to the NAS
- Docker and Docker Compose installed

## Step 1: Create the project directory

```bash
ssh your-nas
mkdir -p ~/whisper-wealth
cd ~/whisper-wealth
```

## Step 2: Create docker-compose.yml

```bash
cat > docker-compose.yml << 'EOF'
services:
  whisperwealth:
    image: ghcr.io/parthghetia-rh/whisper-wealth:latest
    container_name: whisperwealth
    ports:
      - "3000:3000"
    volumes:
      - folio-data:/data
    environment:
      - NODE_ENV=production
      - HOST=0.0.0.0
      - PORT=3000
      - DB_PATH=/data/portfolio.db
      - TOKEN_PATH=/data/.auth-token
    restart: unless-stopped

volumes:
  folio-data:
EOF
```

## Step 3: Start the container

```bash
docker compose up -d
```

## Step 4: Get your auth token

```bash
docker logs whisperwealth | grep "auth token"
```

Save this token — you need it to log in at `http://your-nas-ip:3000`.

## Migrating an Existing Database

If you have a `portfolio.db` from another machine (laptop, server, etc.), follow these steps to import it.

### Export from the source machine

```bash
# From Docker
docker cp whisperwealth:/data/portfolio.db ./portfolio.db

# Or if running locally (not Docker)
cp portfolio.db ./portfolio.db
```

### Transfer to the NAS

```bash
scp portfolio.db your-nas:~/whisper-wealth/portfolio.db
```

### Import into the Docker volume

You cannot simply copy a file into a Docker named volume from the host. Use a temporary Alpine container as a middleman:

```bash
docker run --rm \
  -v whisper-wealth_folio-data:/data \
  -v ~/whisper-wealth/portfolio.db:/source.db \
  alpine sh -c "cp /source.db /data/portfolio.db && chown -R 1001:1001 /data && chmod 700 /data && chmod 600 /data/portfolio.db"
```

**What this command does:**

| Part | Purpose |
|------|---------|
| `docker run --rm alpine` | Starts a temporary container that deletes itself when done |
| `-v whisper-wealth_folio-data:/data` | Mounts WhisperWealth's Docker volume |
| `-v ~/whisper-wealth/portfolio.db:/source.db` | Mounts your local DB file into the container |
| `cp /source.db /data/portfolio.db` | Copies the DB into the volume |
| `chown -R 1001:1001 /data` | Sets ownership to appuser (uid 1001) inside the container |
| `chmod 700 /data` | Directory: only owner can read/write/enter |
| `chmod 600 /data/portfolio.db` | DB file: only owner can read/write |

### Restart the container

```bash
docker restart whisperwealth
```

### Verify

```bash
docker logs whisperwealth --tail 5
```

You should see `WhisperWealth running at http://0.0.0.0:3000` with no permission errors.

## Why the Permission Fix is Needed

- The WhisperWealth container runs as `appuser` (uid 1001), not root
- Docker named volumes are created with root ownership by default
- `docker cp` copies files as root, so the DB ends up owned by root
- uid 1001 can't read a root-owned file → `EACCES: permission denied`
- The Alpine container runs as root, fixes ownership, then exits — the app itself never runs as root

## Accessing from Other Devices

### Local network

Open `http://your-nas-ip:3000` from any device on your network.

### Via Tailscale

If your NAS runs Tailscale, access via `http://your-nas-tailscale-ip:3000` from anywhere. Set `CORS_ORIGINS` in docker-compose.yml if needed:

```yaml
    environment:
      - CORS_ORIGINS=http://your-nas-tailscale-ip:3000
```

## Updating

```bash
cd ~/whisper-wealth
docker compose pull
docker restart whisperwealth
```

Your data persists in the `folio-data` volume — updates don't touch it.

## Backup

```bash
docker cp whisperwealth:/data/portfolio.db ~/whisper-wealth/portfolio-backup-$(date +%Y%m%d).db
```

## Troubleshooting

### Permission denied on startup

```bash
docker run --rm -v whisper-wealth_folio-data:/data alpine chown -R 1001:1001 /data
docker restart whisperwealth
```

### Lost auth token

```bash
docker exec whisperwealth cat /data/.auth-token
```

### Reset everything (fresh start)

```bash
docker compose down
docker volume rm whisper-wealth_folio-data
docker compose up -d
```

This creates a fresh database and new auth token.
