@echo off
REM OrbitShield ST-02 — single-click launch for the full multi-service security demo stack.
REM Usage: double-click start.bat, or run from command line:
REM   cmd /c start.bat
REM
REM This script opens each service in its own console window so you can watch logs:
REM   Ground Console    :3000 -> vite.ground.config.ts (TRUSTED)
REM   Spacecraft Twin   :3100 -> vite.twin.config.ts (TRUSTED)
REM   Attack Simulator  :3500 -> vite.attacker.config.ts (UNTRUSTED)
REM   Security Gateway  :4000 -> backend/ (INTERNAL, Express + SQLite)
REM
REM Tip: keep this window open. Press Ctrl+C in any window to stop that service;
REM or close the window for that service only. Use stop.bat to shut down all services.

cd /d "%~dp0"

echo.
echo ===========================================
echo  OrbitShield ST-02 — Multi-Service Launch
echo ===========================================
echo.

REM Check for npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] npm not found. Please install Node.js and ensure it's in your PATH.
  echo.

  REM Try Git Bash npm
  where git >nul 2>&1
  if %errorlevel% equ 0 (
    echo Git is available. Try running from Git Bash instead.
  )
  pause
  exit /b 1
)

REM Check Node.js version
echo [1/7] Checking prerequisites...
node --version >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] Node.js not found. Please install Node.js v18 or later.
  pause
  exit /b 1
)

echo   Node.js: OK
echo   npm: OK

REM Check if dependencies are installed
if not exist "node_modules\.bin\vite.cmd" (
  echo.
  echo [INFO] Dependencies not found. Installing...
  call npm install
  if %errorlevel% neq 0 (
    echo [ERROR] npm install failed. Check your network connection and try again.
    pause
    exit /b 1
  )
  echo   Dependencies installed: OK
) else (
  echo   Dependencies: OK
)

echo.
echo [2/7] Checking port availability...

set "PORT_ERROR=0"

REM Check port 3000
netstat -ano 2>nul | findstr ":3000" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
  echo   [WARNING] Port 3000 is already in use.
  set "PORT_ERROR=1"
) else (
  echo   [OK] Port 3000 available
)

REM Check port 3100
netstat -ano 2>nul | findstr ":3100" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
  echo   [WARNING] Port 3100 is already in use.
  set "PORT_ERROR=1"
) else (
  echo   [OK] Port 3100 available
)

REM Check port 3500
netstat -ano 2>nul | findstr ":3500" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
  echo   [WARNING] Port 3500 is already in use.
  set "PORT_ERROR=1"
) else (
  echo   [OK] Port 3500 available
)

REM Check port 4000
netstat -ano 2>nul | findstr ":4000" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
  echo   [WARNING] Port 4000 is already in use.
  set "PORT_ERROR=1"
) else (
  echo   [OK] Port 4000 available
)

if %PORT_ERROR% equ 1 (
  echo.
  echo [INFO] Some ports are occupied. The script will attempt to start anyway.
  echo       If services fail to start, close the conflicting applications and retry.
)

echo.
echo [3/7] Starting services...

REM Start backend first (it needs to be ready for health checks)
echo   Starting Security Gateway (backend :4000)...
start "OrbitShield Backend :4000" cmd /c "npm run dev:backend"
timeout /t 3 /nobreak >nul

echo   Starting Ground Console (:3000)...
start "OrbitShield Ground :3000" cmd /c "npm run dev:ground"

echo   Starting SpaceTwin (:3100)...
start "OrbitShield SpaceTwin :3100" cmd /c "npm run dev:twin"

echo   Starting Attacker Simulator (:3500)...
start "OrbitShield Attacker :3500" cmd /c "npm run dev:attacker"

echo.
echo [4/7] Waiting for services to initialize...
timeout /t 5 /nobreak >nul

echo.
echo [5/7] Verifying service health...

REM Health check function
:check_health
set "SERVICE=%1"
set "PORT=%2"
set "URL=%3"
set "ATTEMPTS=0"
set "MAX_ATTEMPTS=15"

:health_loop
if %ATTEMPTS% geq %MAX_ATTEMPTS% goto :health_timeout

REM Try curl health check
curl -s -o NUL -w "%[http_code]" %URL% 2>nul | findstr "200" >nul
if %errorlevel% equ 0 (
  echo   [%SERVICE%] ONLINE (port %PORT%)
  goto :health_ok
)

set /a ATTEMPTS+=1
timeout /t 1 /nobreak >nul
goto :health_loop

:health_timeout
echo   [%SERVICE%] TIMEOUT (port %PORT% — may still be starting)
goto :health_ok

:health_ok

echo.
echo [6/7] Service Status:
echo.

REM Check each service health
call :check_health "Backend" "4000" "http://localhost:4000/api/health"
call :check_health "Ground Console" "3000" "http://localhost:3000"
call :check_health "SpaceTwin" "3100" "http://localhost:3100"
call :check_health "Attacker Simulator" "3500" "http://localhost:3500"

echo.
echo [7/7] Opening browser previews...
start "" "http://localhost:3000"
start "" "http://localhost:3100/twin"
start "" "http://localhost:3500/attacker"

echo.
echo ===========================================
echo  OrbitShield ST-02 — Launch Complete
echo ===========================================
echo.
echo  Services:
echo    Ground Console      http://localhost:3000      [TRUSTED]
echo    SpaceTwin           http://localhost:3100      [TRUSTED]
echo    Attacker Simulator  http://localhost:3500      [UNTRUSTED]
echo    Security Gateway    http://localhost:4000/api  [INTERNAL]
echo.
echo  Trust Zones:
echo    GROUND      TRUSTED      Allowed to communicate with SpaceTwin & Backend
echo    SPACETWIN   TRUSTED      Allowed to communicate with Ground & Backend
echo    ATTACKER    UNTRUSTED    Blocked from accessing trusted services
echo    BACKEND     INTERNAL     Reserved for backend functionality
echo    DATABASE    PRIVATE      SQLite — only accessible through backend
echo.
echo  Communication Policy:
echo    Ground <-> SpaceTwin       ALLOWED (trusted link)
echo    Ground -> Backend          ALLOWED
echo    SpaceTwin -> Backend       ALLOWED
echo    Attacker -> Trusted        BLOCKED
echo.
echo  Security Architecture:
echo    DEFAULT DENY — EXPLICIT ALLOW — LEAST PRIVILEGE
echo.
echo  Quick Reference:
echo    stop.bat          — Stop all OrbitShield services
echo    npm run dev:ground    — Ground only (:3000)
echo    npm run dev:twin      — SpaceTwin only (:3100)
echo    npm run dev:attacker  — Attacker only (:3500)
echo    npm run dev:backend   — Backend only (:4000)
echo    npm run typecheck     — TypeScript check
echo    npm run test          — Run tests
echo.
echo  Press Ctrl+C in this window to close the launcher.
echo  Use stop.bat or close individual windows to stop services.
echo.
pause
