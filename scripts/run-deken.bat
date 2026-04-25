@echo off
setlocal

cd /d "%~dp0"

if not exist "node_modules\electron\package.json" (
  echo [Deken] Missing dependencies. Running npm install once...
  call npm install
  if errorlevel 1 (
    echo [Deken] npm install failed. Please check internet and try again.
    pause
    exit /b 1
  )
)

if not exist "out\main\index.js" (
  echo [Deken] Build output not found. Running npm run build...
  call npm run build
  if errorlevel 1 (
    echo [Deken] Build failed.
    pause
    exit /b 1
  )
)

echo [Deken] Starting app...
call .\node_modules\.bin\electron.cmd .
exit /b %errorlevel%
