@echo off
setlocal enableextensions

rem ============================================================
rem  Vetcos Quote Tool - one-click launcher
rem  SMS Vetcare Technologies Private Limited
rem
rem  Double-click this file to start the app. The first run sets
rem  everything up automatically (installs, builds, makes a secret);
rem  later runs start straight away.
rem ============================================================

title Vetcos Quote Tool
cd /d "%~dp0"

set "PORT=3000"

echo.
echo   ============================================
echo     Vetcos Quote Tool
echo     The Future of Vet Care
echo   ============================================
echo.

rem --- 1. Check Node.js is installed --------------------------------
where node >nul 2>nul
if errorlevel 1 goto :no_node

for /f "delims=" %%v in ('node --version') do set "NODEVER=%%v"
echo   Using Node.js %NODEVER%
echo.

rem --- 2. First-time setup (only if something is missing) -----------
set "NEED_SETUP="
if not exist "node_modules" set "NEED_SETUP=1"
if not exist "client\node_modules" set "NEED_SETUP=1"
if not exist "server\public\index.html" set "NEED_SETUP=1"

if defined NEED_SETUP goto :setup
goto :after_setup

:setup
echo   First-time setup - this may take a few minutes...
echo.
echo   [1/2] Installing dependencies...
call npm run install:all
if errorlevel 1 goto :setup_failed
echo.
echo   [2/2] Building the app...
call npm run build
if errorlevel 1 goto :setup_failed
echo.
echo   Setup complete.
echo.

:after_setup

rem --- 3. Create a sign-in secret on first run ---------------------
rem  (kept out of any parenthesised block so the ( ) in the node
rem   command do not confuse the batch parser)
if not exist ".env" call :make_env

rem --- 4. Start the server and open the browser --------------------
echo   Starting the server on http://localhost:%PORT%
echo.
echo   Please wait - the browser opens automatically once the app is READY.
echo   ^(Opening it too early is what can make it ask to create an admin again.^)
echo   Keep this window open while you use the app.
echo   To stop the app: close this window, or press Ctrl+C.
echo.

rem Open the browser ONLY after the server actually answers, so the setup page
rem never loads against a server that is not ready yet. This PowerShell helper
rem polls the health endpoint for up to ~30s, then launches the browser.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command ^
  "for($i=0;$i -lt 60;$i++){ try { $r=Invoke-WebRequest -Uri 'http://localhost:%PORT%/api/health' -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){ Start-Process 'http://localhost:%PORT%/'; break } } catch {}; Start-Sleep -Milliseconds 500 }"

node server/src/index.js

echo.
echo   The server has stopped.
pause
goto :eof


rem ================= subroutines =================

:make_env
echo   Creating a secure sign-in secret ^(.env^)...
set "SECRET="
for /f "delims=" %%s in ('node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"') do set "SECRET=%%s"
> ".env" echo PORT=%PORT%
>>".env" echo JWT_SECRET=%SECRET%
>>".env" echo TOKEN_EXPIRY=12h
echo   Done.
echo.
goto :eof

:no_node
echo   [!] Node.js was not found on this computer.
echo.
echo       Please install Node.js ^(version 18 or newer^) from:
echo         https://nodejs.org/
echo       Then double-click this file again.
echo.
pause
goto :eof

:setup_failed
echo.
echo   [!] Setup failed. Please check the messages above.
echo.
pause
goto :eof
