@echo off
setlocal DisableDelayedExpansion
pushd "%~dp0" || (
  echo Could not open the project folder.
  pause
  exit /b 1
)
where.exe npm.cmd >nul 2>&1 || (
  echo Install Node.js 24, then reopen start.bat.
  popd
  pause
  exit /b 1
)

rem Parse this block together because an update can replace this file.
(
  call npm.cmd run dev:latest
  if not errorlevel 1 (
    popd
    exit /b 0
  )
  popd
  pause
  exit /b 1
)
