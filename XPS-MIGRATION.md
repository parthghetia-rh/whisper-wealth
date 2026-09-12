# WhisperWealth: NAS to XPS

Status (2026-09-12): user reports WhisperWealth live on XPS. The old NAS container and image were removed without force; its `whisper-wealth_folio-data` volume and backup bind mount remain for rollback. Caddy was reported up again after the cleanup incident. Pi-hole health, the HTTPS route after recovery, and a current XPS off-host backup have not been verified from command output. The steps below are retained as a rebuild and audit runbook. The app stores its portfolio in `/data/portfolio.db` and its login token in `/data/.auth-token` (the `folio-data` volume); daily backups are in the separate `./backups` bind mount, or `/data/backups` if that mount was not writable. A clean stop flushes the database from memory before a copy.

Never commit the database, token, or backups. Do not paste the token into logs or chat. Keep the stopped NAS container, its volume, and its backups for rollback. Do not run `docker compose down -v`.

## 1. Prepare XPS without starting the app

Clone or pull `https://github.com/parthghetia-rh/whisper-wealth` into `/home/parth/code-zone/whisper-wealth`. Use the updated Compose file. Check that no existing XPS WhisperWealth container or populated volume will be overwritten:

```sh
cd /home/parth/code-zone/whisper-wealth
docker ps -a --filter 'name=^/whisperwealth$'
docker volume ls --filter 'name=whisper-wealth_folio-data'
docker compose config --quiet
docker compose pull whisperwealth
sudo install -d -m 0700 -o 1001 -g 1001 backups
install -d -m 0700 /home/parth/whisperwealth-migration
docker compose create whisperwealth
```

If the container or volume already existed before `docker compose create`, stop and inspect it before importing. The app is **not started** yet.

## 2. Freeze and export on NAS

From the NAS directory that currently runs WhisperWealth, first check `/health` and confirm `database.persisted` is `true` and `database.last_save_error` is `null`. Confirm the container's mounts before using the paths below:

```sh
docker inspect whisperwealth --format '{{range .Mounts}}{{println .Destination .Name .Source}}{{end}}'
curl --fail http://127.0.0.1:3000/health
docker compose stop -t 30 whisperwealth
ww_stage=$(mktemp -d)
chmod 700 "$ww_stage"
docker cp whisperwealth:/data/portfolio.db "$ww_stage/portfolio.db"
docker cp whisperwealth:/data/.auth-token "$ww_stage/.auth-token"
test -s "$ww_stage/portfolio.db"
test -s "$ww_stage/.auth-token"
sha256sum "$ww_stage/portfolio.db"
scp "$ww_stage/portfolio.db" "$ww_stage/.auth-token" parth@100.108.39.54:/home/parth/whisperwealth-migration/
```

The NAS is now the frozen rollback copy. Preserve its `./backups` directory too. If `/health` showed a save error or the exported DB is absent, stop and investigate; do not initialize a fresh XPS portfolio.

## 3. Import and verify on XPS

Compare the XPS checksum with the NAS checksum before import. `docker cp` into a container defaults to root ownership, so fix ownership before starting the non-root app:

```sh
cd /home/parth/code-zone/whisper-wealth
sha256sum /home/parth/whisperwealth-migration/portfolio.db
docker cp /home/parth/whisperwealth-migration/portfolio.db whisperwealth:/data/portfolio.db
docker cp /home/parth/whisperwealth-migration/.auth-token whisperwealth:/data/.auth-token
docker run --rm --user 0 --volumes-from whisperwealth --entrypoint sh ghcr.io/parthghetia-rh/whisper-wealth:latest -c 'chown 1001:1001 /data/portfolio.db /data/.auth-token && chmod 600 /data/portfolio.db /data/.auth-token'
docker compose start whisperwealth
docker compose ps
curl --fail http://127.0.0.1:3000/health
```

The health response should report `status: ok`, `database.persisted: true`, and `database.last_save_error: null`. From the XPS desktop, open `http://127.0.0.1:3000` and verify login, account balances, transaction counts, watchlist, and a recent entry against the NAS copy. The preserved token should keep the existing login credential. Do not cut over based on health alone.

## 4. Private route and Caddy cutover

On XPS, publish only the loopback listener to the tailnet:

```sh
sudo tailscale serve --bg --tcp=3000 tcp://127.0.0.1:3000
sudo tailscale serve status
curl --fail "http://$(tailscale ip -4):3000/health"
```

From the NAS, verify `curl --fail http://100.108.39.54:3000/health`. Then pull `homelab-config` in the NAS Caddy directory, set `WHISPERWEALTH_UPSTREAM=100.108.39.54:3000` in its ignored `.env`, and recreate only Caddy:

```sh
cd /home/sketchy_gamer/jelly-fin/caddy-pihole
git pull --ff-only
docker compose config --quiet
docker compose up -d --build --force-recreate caddy
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile
curl --fail https://whisperwealth.builtbyparth.org:8443/health
```

Verify the portfolio again through the normal HTTPS URL. On the NAS dashboard, set `WHISPERWEALTH_HEALTH_URL=http://100.108.39.54:3000` in its ignored `.env` and recreate only the dashboard after its code update is pulled. This moves its health check and host label to XPS.

## 5. Backup and rollback

The XPS `./backups` mount now receives daily snapshots; confirm the active backup path in `/health`, its write permissions, and that a new backup appears. Arrange a separate backup from XPS to NAS/offsite before deleting any old NAS data. Do not delete the old volume or backup history during cutover.

If XPS validation fails, stop XPS WhisperWealth, set `WHISPERWEALTH_UPSTREAM=localhost:3000` on NAS Caddy, recreate Caddy, and start the original NAS container. If any writes occurred on XPS after cutover, export and reconcile that newer database before rolling back—never run two writable instances against divergent copies.

## NAS cleanup: target the container, not the current Compose directory

WhisperWealth is a separate Compose project from `caddy-pihole`. Before cleanup, confirm the container and image from **any** NAS directory:

```sh
docker inspect whisperwealth --format '{{.Name}} {{.Config.Image}} {{.State.Status}} {{range .Mounts}}{{.Destination}}={{.Name}} {{end}}'
docker ps -a --filter 'name=^/whisperwealth$'
```

Only after the output identifies the old WhisperWealth container, the XPS portfolio and HTTPS route are verified, and Caddy/Pi-hole are healthy:

```sh
docker stop whisperwealth
docker rm whisperwealth
docker image rm ghcr.io/parthghetia-rh/whisper-wealth:latest
```

`docker stop` may say the old container is already stopped; in that case proceed with `docker rm`. These commands preserve `whisper-wealth_folio-data` and the separate NAS `./backups` bind mount. Keep both until an XPS backup has been copied off-host and verified. Do not force-remove the image, run `docker compose down -v`, or prune volumes.

### 2026-09-12 wrong-project cleanup incident

The command `docker compose down` was run while the NAS shell was in the `caddy-pihole` project. Its output showed **Caddy and Pi-hole removed**, not WhisperWealth. A subsequent image removal failed because container `cc47b0ff9498` still referenced the WhisperWealth image. The NAS `/data` mount was identified as `whisper-wealth_folio-data` at `/volume1/@docker/volumes/whisper-wealth_folio-data/_data`.

The user later ran `docker compose down` in the actual `whisper-wealth` project. Output confirmed the old `whisperwealth` container and project network were removed, then the image was removed **without force**. No volume removal was reported, so keep `whisper-wealth_folio-data` and the old backup bind mount as rollback copies. The user subsequently reported Caddy up again. Pi-hole health, the normal WhisperWealth HTTPS route, and an XPS off-host backup were not independently verified from command output.

First recover the NAS network stack from its known directory:

```sh
cd /home/sketchy_gamer/jelly-fin/caddy-pihole
docker compose up -d
docker compose ps
curl --fail https://whisperwealth.builtbyparth.org:8443/health
```

If Caddy or Pi-hole does not return healthy, inspect `docker compose logs --tail=100 caddy pihole` before attempting any WhisperWealth cleanup. Confirm `docker inspect cc47b0ff9498 --format '{{.Name}} {{.Config.Image}} {{.State.Status}}'` identifies the old WhisperWealth container before removing it without `--force`.
