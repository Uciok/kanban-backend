# Scripts

Run from anywhere; they work relative to the project root.

- `start.sh` (Mac, Linux) / `start.ps1` (Windows): build the `pm-app` image, replace any running `pm-app` container, run it on port 8000 with `.env` and the `pm-data` volume mounted at `/app/data`
- `stop.sh` / `stop.ps1`: stop and remove the `pm-app` container (the volume is kept)
