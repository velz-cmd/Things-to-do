@echo off
REM Run from anywhere — switches to repo root (parent of scripts\)
cd /d "%~dp0.."

if not exist "package.json" (
  echo Error: package.json not found. Clone the repo first.
  echo   git clone https://github.com/velz-cmd/Things-to-do.git
  exit /b 1
)

if not exist "jellyfin-bridge.env" (
  echo.
  echo Missing jellyfin-bridge.env in repo root.
  echo   copy scripts\jellyfin-bridge.env.example jellyfin-bridge.env
  echo Then edit jellyfin-bridge.env with your API key and RESOLVE_USER_ID.
  echo.
  echo Find RESOLVE_USER_ID: sign in at https://things-to-do-eta.vercel.app/profile
  echo   then open https://things-to-do-eta.vercel.app/api/profile/me
  echo.
  exit /b 1
)

echo Running Jellyfin bridge from %CD% ...
call npx tsx scripts/jellyfin-bridge.ts
exit /b %ERRORLEVEL%
