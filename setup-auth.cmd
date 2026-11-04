@echo off
setlocal
title TypeIran - One-time secure login setup
cd /d "%~dp0"

echo ============================================================
echo       TYPEIRAN - ONE-TIME LOGIN SESSION SETUP
echo ============================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required for this one-time setup.
  echo Install it from: https://nodejs.org/
  echo Then double-click this file again.
  echo.
  pause
  exit /b 1
)

echo [1/3] Installing project dependencies...
call npm install
if errorlevel 1 goto :error

echo.
echo [2/3] Installing Chromium...
call npx playwright install chromium
if errorlevel 1 goto :error

echo.
echo [3/3] Opening TypeIran for your own login...
call npm run auth:setup
if errorlevel 1 goto :error

echo.
echo ============================================================
echo SETUP FILES CREATED:
echo typeiran-storage-state-b64.txt
echo.
echo Add its complete contents as GitHub Actions secret:
echo TYPEIRAN_STORAGE_STATE_B64
echo Then create Actions variable:
echo TYPEIRAN_AUTOMATION_ENABLED = true
echo ============================================================
echo.
pause
exit /b 0

:error
echo.
echo SETUP FAILED. Read the error above.
echo No password or session data was sent to ChatGPT.
pause
exit /b 1
