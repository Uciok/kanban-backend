$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
docker build -t pm-app .
docker rm -f pm-app 2>$null
docker run -d --name pm-app -p 8000:8000 --env-file .env -v pm-data:/app/data pm-app
Write-Output "Running at http://localhost:8000"
