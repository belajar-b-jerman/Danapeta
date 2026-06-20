@echo off
setlocal
title DANAPETA VPS Server

cd /d "%~dp0"

if "%PORT%"=="" set "PORT=8080"
if "%HOST%"=="" set "HOST=0.0.0.0"

echo.
echo ========================================
echo  DANAPETA - Build dan Server VPS Windows
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terinstall.
  echo Install Node.js LTS dulu dari https://nodejs.org/
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm tidak ditemukan. Pastikan Node.js LTS terinstall dengan benar.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo node_modules belum ada. Menjalankan npm install...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install gagal.
    pause
    exit /b 1
  )
)

echo.
echo Membuat build production...
call npm run build
if errorlevel 1 (
  echo.
  echo Build gagal. Cek pesan error di atas.
  pause
  exit /b 1
)

echo.
echo Mencoba membuka firewall port %PORT% jika file ini dijalankan sebagai Administrator...
net session >nul 2>nul
if errorlevel 1 (
  echo Tidak berjalan sebagai Administrator. Jika HP belum bisa akses, buka port %PORT% manual di Windows Firewall/VPS panel.
) else (
  netsh advfirewall firewall add rule name="DANAPETA PWA %PORT%" dir=in action=allow protocol=TCP localport=%PORT% >nul 2>nul
  echo Firewall rule untuk port %PORT% sudah dibuat atau sudah tersedia.
)

echo.
echo Server akan berjalan di:
echo   http://localhost:%PORT%
echo   http://IP-VPS-KAMU:%PORT%
echo.
echo Catatan:
echo - Untuk PWA install penuh di HP, gunakan domain + HTTPS.
echo - Tanpa HTTPS, app tetap bisa dibuka dari browser HP, tapi fitur install PWA bisa dibatasi.
echo - Data tetap lokal per device. Pakai Backup/Restore untuk pindah data.
echo.

node server.cjs

echo.
echo Server berhenti.
pause
