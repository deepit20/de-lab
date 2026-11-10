@echo off
rem Starts the DE Lab server in the background (if it isn't running) and opens the app in its own window.
set PORT=5178
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient('localhost', %PORT%); $c.Close(); exit 0 } catch { exit 1 }"
if errorlevel 1 (
  start "" /min "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0serve.ps1" -Port %PORT%
  "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "Start-Sleep -Milliseconds 700"
)
rem Prefer Edge/Chrome "app mode" (no tabs or address bar, feels like a desktop app)
where msedge >nul 2>nul && (start "" msedge --app=http://localhost:%PORT%/ & exit /b)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:%PORT%/ & exit /b)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://localhost:%PORT%/ & exit /b)
start "" http://localhost:%PORT%/
