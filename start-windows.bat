@echo off
cd /d "%~dp0"
echo Starting AccessBridge AI...

where py >nul 2>nul
if %errorlevel%==0 (
  start "AccessBridge server - keep this window open" py -m http.server 8000
  timeout /t 3 /nobreak >nul
  start "" "http://localhost:8000/index.html"
  goto :done
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "AccessBridge server - keep this window open" python -m http.server 8000
  timeout /t 3 /nobreak >nul
  start "" "http://localhost:8000/index.html"
  goto :done
)

echo Python was not found, so opening the app directly in your browser.
start "" "index.html"

:done
echo.
echo If the page opened, you can close THIS window. Keep the other server window open.
pause
