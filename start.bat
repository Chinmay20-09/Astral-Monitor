@echo off
REM OrbitShield ST-02 — single-click launch for the full multi-screen demo stack.
REM Usage: double-click start.bat, or run from an admin PowerShell:
REM   start /b powershell -NoProfile -Command "cd C:\OrbitShield & cmd /c start /b start.bat"
REM
REM This script opens each screen in its own console window so you can watch logs:
REM   Ground Console :3000  -> index.html (single root app: /, /twin, /attacker)
REM   Spacecraft Twin     :3010 -> vite.twin.config.ts
REM   Attack Simulator    :3500 -> vite.attacker.config.ts
REM   Security gateway    :4000 -> backend/ (Express + SQLite)
REM
REM Tip: keep this window open. Press Ctrl+C in any window to stop that screen;
REM or close the window for that screen only.
cd /d "%~dp0"

where npm >nul 2>&1
if %errorlevel% neq 0 (
  echo [start.bat] npm not found. Make sure you are in a Git Bash / Node.js terminal.
  pause
  exit /b 1
)

echo.
echo ============================================
echo  OrbitShield ST-02 — Multi-Screen Launch
echo ============================================
echo.
echo 1/4 Launching security gateway backend  (http://localhost:4000/api)...
start /b npm run dev:backend
timeout /t 4 /nobreak >nul

echo.
echo 2/4 Launching frontends in separate windows...
start "Ground Console :3000" cmd /c "npm run dev:ground"
start "Spacecraft Twin :3010"   cmd /c "npm run dev:twint"
start "Attack Simulator :3500"  cmd /c "npm run dev:attacker"

echo.
echo 3/4 Verifying the backend...
for %%i in (1 2 3) do (
  for /l %%a in (1,1,20) do (
    curl -s -o NUL -w "Backend HTTP status: %%[http_code]^| Attempt %%a/20^| Retrying in 2s..." http://localhost:4000/api/health 2>nul
    if %%a geq 5 (timeout /t 2 /nobreak >nul)
    curl -s http://localhost:4000/api/health 2>nul | findstr /c:"\"status\"" >nul 2>&1
    if !errorlevel! equ 0 (
      echo.
      echo.
      echo  Backend is alive on :4000
      goto :backend_ok
    )
  )
)
:backend_ok

echo.
echo 4/4 Opening browser previews...
start "" "http://localhost:3000"
start "" "http://localhost:3010/twin"
start "" "http://localhost:3500/attacker"

echo.
echo All screens launched — the shared frontend root serves:
echo   Ground Console  -> http://localhost:3000
echo   Spacecraft Twin -> http://localhost:3010/twin
echo   Attack Simulator-> http://localhost:3500/attacker
echo.
echo Build/preview status:
echo   npm run dev        — start the whole stack (this script)
echo   npm run dev:ground — ground console only (:3000, single root app)
echo   npm run dev:twint  — twin only (:3010)
echo   npm run dev:attacker — attacker only (:3500)
echo   npm run dev:backend — backend only (:4000)
echo   npm run typecheck  — TypeScript check (root + backend)
echo   npm run test       — full test suite
echo   npm run test:backend — backend suite
echo.
echo Press Ctrl+C in this window to stop every screen.
echo.
pause
