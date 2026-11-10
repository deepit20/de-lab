@echo off
rem Stops the background DE Lab server. Your learning data is kept (it lives in the browser).
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*serve.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo DE Lab server stopped.
timeout /t 2 >nul
