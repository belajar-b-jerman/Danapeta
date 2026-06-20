# Panduan Cepat DANAPETA di VPS Windows

## Tujuan

Menjalankan DANAPETA dari VPS Windows agar bisa dibuka lewat HP.

## Cara paling praktis

1. Pastikan Node.js LTS sudah terinstall di VPS.
2. Copy folder program DANAPETA ke VPS.
3. Klik kanan `RUN_DANAPETA_VPS.bat`.
4. Pilih `Run as administrator` agar script bisa membuka firewall port.
5. Tunggu sampai muncul:

```txt
DANAPETA server aktif.
Local : http://localhost:8080
Public: http://IP-VPS-KAMU:8080
```

6. Dari HP, buka:

```txt
http://IP-VPS-KAMU:8080
```

Ganti `IP-VPS-KAMU` dengan public IP VPS.

## Kalau tidak bisa dibuka dari HP

Cek tiga hal ini:

1. Window server masih terbuka di VPS.
2. Windows Firewall membuka port `8080`.
3. Firewall/security group dari provider VPS juga membuka TCP port `8080`.

## Tentang PWA

DANAPETA sudah punya manifest dan service worker di build production. Untuk install PWA yang lebih mulus di HP, gunakan domain/subdomain dengan HTTPS.

Tanpa HTTPS, app biasanya tetap bisa dibuka lewat browser HP, tetapi fitur install PWA/service worker bisa dibatasi oleh browser.

## Tentang data

Mode ini belum cloud sync.

Data tetap tersimpan lokal di masing-masing device:

- data laptop tersimpan di browser laptop
- data HP tersimpan di browser HP
- server hanya menyajikan aplikasi

Untuk memindahkan data sementara:

1. Export backup dari device pertama.
2. Buka DANAPETA di device kedua.
3. Restore file backup.

## Mengubah port

Jalankan dari Command Prompt:

```bat
set PORT=3000
RUN_DANAPETA_VPS.bat
```

Atau edit baris ini di `RUN_DANAPETA_VPS.bat`:

```bat
if "%PORT%"=="" set "PORT=8080"
```
