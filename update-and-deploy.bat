@echo off
chcp 65001 >nul
echo ========================================================
echo   LungJi - Syncing Latest MTG Prices from Card Kingdom
echo ========================================================
cd /d "%~dp0"

echo 1. Downloading live prices from Card Kingdom...
call node scripts/sync-prices.js
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to sync prices!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo 2. Deploying updated prices to Vercel...
call npx vercel deploy --prod --yes
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to deploy to Vercel!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================================
echo   [SUCCESS] Prices updated & deployed to lungji.vercel.app!
echo ========================================================
pause
