# Itinerary

Web pribadi untuk merencanakan perjalanan, **dioptimalkan untuk HP**, dengan Google Sheets sebagai database.

- **Frontend/Backend**: Next.js 14 (App Router) + TailwindCSS
- **Auth**: NextAuth (Credentials, kredensial disimpan di env)
- **Database**: Google Sheets via Service Account
- **Maps**: Google Maps Universal URL (tanpa API key, tanpa biaya)
- **Hosting**: Vercel (gratis)

Layout dibatasi `max-width: 480px` dan di-center, jadi kalau dibuka di desktop tetap tampil seperti HP.

---

## 1. Persiapan Google Cloud + Sheets

1. **Buat Google Sheet baru**. Tambahkan satu tab bernama `Itinerary` (atau nama lain, simpan ke env `GOOGLE_SHEET_TAB_NAME`). Header akan dibuat otomatis saat pertama kali aplikasi diakses.
2. **Buka [Google Cloud Console](https://console.cloud.google.com/)**:
   - Buat project baru (mis. `itinerary-pribadi`).
   - Buka **APIs & Services → Library**, aktifkan **Google Sheets API**.
   - Buka **APIs & Services → Credentials → Create Credentials → Service Account**.
   - Isi nama, klik Create. Skip role (atau pilih `Viewer` saja).
   - Setelah dibuat, masuk ke service account → tab **Keys → Add Key → Create new key → JSON**. File JSON akan ter-download.
3. **Share Google Sheet ke service account**:
   - Buka Sheet → tombol **Share**.
   - Tempelkan email service account (format `xxx@xxx.iam.gserviceaccount.com`), beri akses **Editor**.

## 2. Setup lokal

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:

- `NEXTAUTH_SECRET` — random string panjang (mis. `openssl rand -base64 32`).
- `GOOGLE_SHEET_ID` — bagian dari URL Sheets di antara `/d/` dan `/edit`.
- `GOOGLE_SERVICE_ACCOUNT_JSON` — **paste seluruh isi file JSON service account sebagai satu baris**.

> **User & login**: akun disimpan di tab `Users` pada Google Sheet (kolom: User ID, Nama, Nama Lengkap, Password). Tab ini dibuat otomatis. Daftar akun lewat halaman `/register`, lalu login lewat `/login`. Tidak perlu lagi env `USER_ID_*` / `USER_PASS_*`.

Jalankan dev server:

```bash
npm run dev
```

Buka `http://localhost:3000` → akan redirect ke `/login`. Belum punya akun? Klik **Daftar** untuk registrasi.

## 3. Deploy ke Vercel

1. Push repo ini ke GitHub (file `.env.local` sudah di-ignore).
2. Import repo di [vercel.com](https://vercel.com).
3. Di **Settings → Environment Variables**, isi SEMUA variabel dari `.env.local`:
   - `NEXTAUTH_URL` ganti ke domain Vercel kamu (mis. `https://itinerary-anda.vercel.app`).
   - `NEXTAUTH_SECRET`, `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`.
4. Deploy.

> **Tips**: untuk `GOOGLE_SERVICE_ACCOUNT_JSON`, di Vercel cukup paste isi file JSON apa adanya (boleh multi-line). Lib akan otomatis meng-handle escape `\n` di `private_key`.

## 4. Struktur Sheet

Sheet `Itinerary` (header dibuat otomatis):

| ID | Tanggal | Jam Berangkat | Lokasi Asal | Lokasi Tujuan | Estimasi Durasi | Jam Tiba | Catatan |
|----|---------|---------------|-------------|---------------|-----------------|----------|---------|

Tanggal disimpan format `DD/MM/YYYY`, jam format `HH:MM`. Estimasi durasi diisi manual (mis. `45 menit`).

## 5. Pakai sebagai aplikasi (PWA-like)

Di HP, buka websitenya, lalu **Add to Home Screen** dari browser. Sudah ada `manifest.webmanifest` & viewport mobile.

## 6. Fitur

- Login userid/password (max 5 akun, dari env)
- Daftar perjalanan dikelompokkan per tanggal, diurutkan tanggal+jam
- Tombol **Buka di Maps** → langsung membuka rute di Google Maps di HP
- Klik nama lokasi → search di Maps
- Tambah & hapus rencana
- Tanpa biaya: tidak pakai Maps API key, hanya butuh Google Sheets API (gratis)
