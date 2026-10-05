@echo off
REM OrbitShield ST-02 — graceful shutdown for all OrbitShield services.
REM Usage: double-click stop.bat, or run from command line:
REM   cmd /c stop.bat
REM
REM This script stops only OrbitShield processes, not unrelated Node apps.
REM It tracks processes by their command-line arguments.

cd /d "%~dp0"

echo.
echo ===========================================
echo  OrbitShield ST-02 — Shutdown
echo ===========================================
echo.

setlocal enabledelayedexpansion

REM Function to find and stop processes by keyword
:stop_by_keyword
  set "keyword=%~1"
  set "label=%~2"
  
  echo Checking %label%...
  
  REM Use tasklist to find matching processes
  for /f "tokens=2 delims=," %%p in ('tasklist /fi "IMAGENAME eq node.exe" /fo csv 2^>nul') do (
    set "pids=!pids! %%p"
  )
  
  REM Search for OrbitShield processes
  for /f "tokens=2" %%p in ('tasklist /fi "IMAGENAME eq node.exe" /fo list 2^>nul ^| findstr /i "%keyword%"') do (
    echo   Stopping OrbitShield %label% (PID: %%p)...
    taskkill /pid %%p /f >nul 2>&1
  )
  
  set "pids="
  goto :eof

echo 1/5 Stopping services...

REM Stop backend (check for tsx or node running backend)
echo   Looking for Backend (port 4000)...
for /f "tokens=2 delims=," %%p in ('tasklist /fi "IMAGENAME eq node.exe" /fo csv 2^>nul ^| findstr /i "backend"') do (
  echo   Stopping backend (PID: %%p)...
  taskkill /pid %%p /f >nul 2>&1
)

REM Fallback: kill by port if process tracking fails
echo   Checking port 4000...
netstat -ano 2>nul | findstr ":4000" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
  for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":4000" ^| findstr "LISTENING"') do (
    echo   Killing process on port 4000 (PID: %%p)...
    taskkill /pid %%p /f >nul 2>&1
  )
)

echo   Looking for Ground Console (port 3000)...
for /f "tokens=2 delims=," %%p in ('tasklist /fi "IMAGENAME eq node.exe" /fo csv 2^>nul ^| findstr /i "ground"') do (
  echo   Stopping ground console (PID: %%p)...
  taskkill /pid %%p /f >nul 2>&1
)

echo   Checking port 3000...
netstat -ano 2>nul | findstr ":3000" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
  for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo   Killing process on port 3000 (PID: %%p)...
    taskkill /pid %%p /f >nul 2>&1
  )
)

echo   Looking for SpaceTwin (port 3100)...
for /f "tokens=2 delims=," %%p in ('tasklist /fi "IMAGENAME eq node.exe" /fo csv 2^>nul ^| findstr /i "twin"') do (
  echo   Stopping spacetwin (PID: %%p)...
  taskkill /pid %%p /f >nul 2>&1
)

echo   Checking port 3100...
netstat -ano 2>nul | findstr ":3100" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
  for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3100" ^| findstr "LISTENING"') do (
    echo   Killing process on port 3100 (PID: %%p)...
    taskkill /pid %%p /f >nul 2>&1
  )
)

echo   Looking for Attacker (port 3500)...
for /f "tokens=2 delims=," %%p in ('tasklist /fi "IMAGENAME eq node.exe" /fo csv 2^>nul ^| findstr /i "attacker"') do (
  echo   Stopping attacker (PID: %%p)...
  taskkill /pid %%p /f >nul 2>&1
)

echo   Checking port 3500...
netstat -ano 2>nul | findstr ":3500" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
  for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3500" ^| findstr "LISTENING"') do (
    echo   Killing process on port 3500 (PID: %%p)...
    taskkill /pid %%p /f >nul 2>&1
  )
)

echo.
echo 2/5 Verifying shutdown...
timeout /t 2 /nobreak >nul

set "remaining=0"

echo   Port 4000 (Backend): 
netstat -ano 2>nul | findstr ":4000" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
  echo     STILL ACTIVE
  set "remaining=1"
) else (
  echo     STOPPED
)

echo   Port 3000 (Ground): 
netstat -ano 2>nul | findstr ":3000" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
  echo     STILL ACTIVE
  set "remaining=1"
) else (
  echo     STOPPED
)

echo   Port 3100 (SpaceTwin): 
netstat -ano 2>nul | findstr ":3100" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
  echo     STILL ACTIVE
  set "remaining=1"
) else (
  echo     STOPPED
)

echo   Port 3500 (Attacker): 
netstat -ano 2>nul | findstr ":3500" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
  echo     STILL ACTIVE
  set "remaining=1"
) else (
  echo     STOPPED
)

echo.
if %remaining% equ 0 (
  echo [OK] All OrbitShield services stopped successfully.
) else (
  echo [!] Some services may still be running. Check the windows manually.
)

echo.
echo OrbitShield shutdown complete.
echo.

pause
