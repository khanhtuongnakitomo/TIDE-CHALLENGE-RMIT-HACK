# Local TideCloak development setup (Windows)

This guide starts a local TideCloak development container only. It does not create the ResearchVault realm or configure app roles/policies. The container is for local development, not production. Keep the admin password on this machine; do not paste it into chat or commit it.

## 1. Install and start Docker Desktop

Install Docker Desktop using the official [Windows guide](https://docs.docker.com/desktop/setup/install/windows-install/). The per-user installer and WSL 2 backend are the recommended default for most Windows users. Use Linux containers.

In PowerShell, check WSL if needed:

```powershell
wsl --version
```

If WSL is missing, follow Microsoft's linked setup in the Docker guide (for example, `wsl --install`); reboot if Windows requests it. If WSL exists but needs updating, run `wsl --update`. Do not run these commands when the WSL backend is already current.

Start Docker Desktop from the Start menu, wait until its engine reports ready, then open PowerShell and enter this repository folder before verifying:

```powershell
Set-Location 'D:\Coding\Prj\RMITHACK\TIDE-CHALLENGE-RMIT-HACK'
docker version
docker info
```

Both client and server information should appear. If Docker commands are unavailable or the server section fails, finish Docker Desktop setup before continuing.

## 2. Create a private local admin password

Create the ignored local data folder and copy the blank template:

```powershell
New-Item -ItemType Directory -Force .\data | Out-Null
if (-not (Test-Path -LiteralPath '.\data\tidecloak-docker.env')) {
  Copy-Item .\tidecloak.env.example .\data\tidecloak-docker.env
} else {
  Write-Host 'Existing private TideCloak env file left unchanged.'
}
notepad .\data\tidecloak-docker.env
```

In `data\tidecloak-docker.env`, set `KC_BOOTSTRAP_ADMIN_PASSWORD` to a 32-character or longer random alphanumeric password from your password manager. If you choose a value containing `$` or `#`, wrap it in single quotes in this env file so Compose treats it literally. This file is ignored by Git. Do not put the password in `compose.tidecloak.yaml`, `.env.example`, screenshots, chat, or command arguments.

## 3. Start the pinned development image

The Compose file pins Tide's development image to `0.14.41`, binds port 8080 to loopback only, and keeps its H2 data in the named Docker volume `researchvault-tide-data`. It has no automatic restart policy.

Run these commands in the repository root PowerShell window:

```powershell
$composeArgs = @('--env-file', '.\data\tidecloak-docker.env', '-f', '.\compose.tidecloak.yaml')
docker compose @composeArgs config --quiet
docker compose @composeArgs up -d
docker compose @composeArgs ps
```

`config --quiet` checks interpolation without printing the expanded configuration (which contains the password). If the blank template was not filled, Compose stops with a missing-password error. Do not run plain `docker compose config` in a shared terminal because it displays resolved environment values.

If the new container exits with `AccessDeniedException` for `keycloakdb.mv.db` or `keycloakdb.trace.db`, check that the volume files belong to the image's non-root service user. The pinned image runs as UID 1000. Correct ownership in place, then start Compose again; this preserves the named volume and its contents:

```powershell
docker run --rm --user 0 --entrypoint /bin/sh `
  -v researchvault-tide-data:/data `
  tideorg/tidecloak-dev:0.14.41 `
  -c 'chown -R 1000:0 /data'
docker compose @composeArgs up -d
```

Do not delete the volume to work around a permissions error.

Wait a few seconds, then check the local master realm endpoint:

```powershell
(Invoke-WebRequest -Uri 'http://127.0.0.1:8080/realms/master' -UseBasicParsing -TimeoutSec 5).StatusCode
```

`200` means the local server responds. This is only a container readiness check; it does not mean the ResearchVault realm, app client, governance, or shared-data policy has been provisioned. If it is not ready, inspect `docker compose @composeArgs logs --tail 100 tidecloak` locally and review output before sharing any part of it.

## 4. Stop and resume safely

To stop the service while preserving its named data volume:

```powershell
docker compose @composeArgs down
```

Resume it later with `docker compose @composeArgs up -d`. Do not add `--volumes`, run `docker volume rm`, or remove `researchvault-tide-data`; those actions erase the local TideCloak state.

## What to send back

The current container readiness check returns `200` at `http://127.0.0.1:8080/realms/master`, and Compose binds the service only to `127.0.0.1:8080`. The canonical `researchvault` realm and `researchvault-web` client were imported from the full Tide template. Tide setup then failed with HTTP 500 because Midgard `FinalizeWallet` returned HTTP 503. The realm has a Tide IdP, but licensing is unresolved; IGA is off, there is no admin invite link, and no adapter JSON was exported. The pending-license indicator and expiry field do not establish a usable completed license. Do not retry or delete this partial realm without a supported recovery path. Keep `data\tidecloak-docker.env` private and do not share its contents or logs containing credentials.

Tide's current [Quickstart](https://docs.tide.org/get-started/Tidecloak%20Quickstart) describes its development container and interactive admin enrollment. This handoff uses a dedicated named volume, loopback-only port binding, and required strong local password instead of the Quickstart's sample password and repository-directory bind mount. The pinned [image tags](https://hub.docker.com/r/tideorg/tidecloak-dev/tags) were checked on 22 October 2026; verify availability if using this guide later.
