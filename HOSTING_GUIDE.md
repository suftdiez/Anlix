# Panduan Hosting Anlix (Gratis & Stabil)

Panduan ini menuntun kamu deploy aplikasi Anlix menggunakan **Vercel** (untuk Frontend) dan **Render** (untuk Backend). Kombinasi ini memberikan kuota gratis yang besar dan stabilitas tinggi.

## 📊 Analisis Bandwidth & Biaya

### 1. Vercel (Frontend) - Gratis
- **Kuota Bandwidth:** 100 GB / bulan.
- **Penggunaan:** Hanya untuk memuat tampilan web (HTML/CSS/JS).
- **Estimasi:** Cukup untuk **~50.000 - 100.000 pengunjung/bulan**.
- **Status:** **Sangat Aman** untuk skala personal maupun publik menengah.

### 2. Render (Backend API) - Gratis
- **Kuota Bandwidth:** 100 GB / bulan.
- **Penggunaan:** Untuk API data (judul, poster, sinopsis) dan **Stream Proxy** (khusus Rebahin).
- **Peringatan:** Fitur "Stream Proxy" Rebahin memakan bandwidth karena video lewat server ini.
  - 1 Film HD ≈ 500 MB - 1 GB.
  - Kuota 100 GB habis setelah streaming **100-200 film full**.
- **Tips Hemat:** Sumber lain (Otakudesu, dll) pakai *Direct Link/Iframe* yang **TIDAK** memakan kuota backend ini. Jadi aman banget.

---

## 🚀 Langkah Deploy

### Bagian 1: Persiapan Code
1.  Pastikan project sudah di-upload ke **GitHub**.
2.  Pastikan ada file `vercel.json` di folder `frontend` dan `render.yaml` di folder `backend` (Sudah saya buatkan).

### Bagian 2: Deploy Backend (Render.com)
Backend harus online dulu supaya Frontend bisa connect.

1.  Buka [Render.com](https://render.com) dan Login (bisa pakai GitHub).
2.  Klik **"New"** -> **"Web Service"**.
3.  Pilih repository GitHub kamu.
4.  Isi form berikut:
    -   **Name:** `anlix-backend`
    -   **Root Directory:** `backend` (Penting!)
    -   **Environment:** `Node`
    -   **Global Region:** Singapore (Disarankan)
    -   **Build Command:** `npm install && npm run build`
    -   **Start Command:** `npm start`
    -   **Plan:** Free
5.  **Environment Variables (Wajib Diisi):**
    -   `NODE_ENV` = `production`
    -   `PUPPETEER_CACHE_DIR` = `/opt/render/.cache/puppeteer`
    -   Klik **"Advanced"** -> **"Add Environment Variable"**.
6.  Klik **"Create Web Service"**.
7.  Tunggu sampai selesai. Nanti kamu dapat URL (misal: `https://anlix-backend.onrender.com`).
8.  **Copy URL tersebut.**

### Bagian 3: Deploy Frontend (Vercel)

1.  Buka [Vercel.com](https://vercel.com) dan Login.
2.  Klik **"Add New..."** -> **"Project"**.
3.  Import repository GitHub kamu.
4.  **Configure Project:**
    -   **Framework Preset:** Next.js
    -   **Root Directory:** Klik "Edit" dan pilih folder `frontend`.
5.  **Environment Variables:**
    -   Masukkan `NEXT_PUBLIC_API_URL` dengan nilai URL Backend dari Render tadi (contoh: `https://anlix-backend.onrender.com`).
6.  Klik **"Deploy"**.
7.  Tunggu sebentar... Selesai! 🎉

---

## 🔍 Cek Status
Setelah deploy, buka URL dari Vercel. Web kamu sekarang sudah online dan bisa diakses siapa saja!
- Jika video Rebahin buffering, cek limit bandwidth di dashboard Render.
- Jika ada error, cek logs di dashboard Vercel/Render.

Selamat mencoba! 🚀
