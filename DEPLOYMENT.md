# 🚀 Panduan Deployment ANLIX

## Arsitektur Deployment

```
┌─────────────────┐     ┌─────────────────┐
│    VERCEL       │     │    RAILWAY      │
│  (Frontend)     │────▶│   (Backend)     │
│   Next.js       │     │   Express.js    │
└─────────────────┘     └─────────────────┘
```

---

## 📋 Persiapan

### 1. Push ke GitHub
```bash
# Di folder project utama (c:\Anlix)
git init
git add .
git commit -m "Initial commit - ANLIX streaming website"
git branch -M main
git remote add origin https://github.com/USERNAME/anlix.git
git push -u origin main
```

---

## 🔵 Deploy Backend ke Railway

### Step 1: Buat Akun & Project
1. Buka https://railway.app
2. Login dengan GitHub
3. Klik **"New Project"** → **"Deploy from GitHub repo"**
4. Pilih repository `anlix`

### Step 2: Configure Service
1. Klik service yang terbuat
2. Pilih **"Settings"** → Set:
   - **Root Directory**: `backend`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`

### Step 3: Set Environment Variables
Klik **"Variables"** → Add:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `MONGODB_URI` | `mongodb+srv://...` (dari MongoDB Atlas) |
| `JWT_SECRET` | `your-super-secret-jwt-key-here` |
| `SCRAPE_CACHE_TTL` | `3600` |

### Step 4: Deploy
1. Railway akan auto-deploy
2. Salin **domain** yang diberikan, contoh: `anlix-backend.up.railway.app`

---

## 🟢 Deploy Frontend ke Vercel

### Step 1: Buat Akun & Project
1. Buka https://vercel.com
2. Login dengan GitHub
3. Klik **"Add New"** → **"Project"**
4. Import repository `anlix`

### Step 2: Configure Project
1. **Framework Preset**: Next.js
2. **Root Directory**: `frontend`
3. **Build Command**: `npm run build`

### Step 3: Set Environment Variables
| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://anlix-backend.up.railway.app` |

> ⚠️ Ganti dengan domain Railway kamu yang sebenarnya!

### Step 4: Deploy
1. Klik **"Deploy"**
2. Tunggu build selesai
3. Website akan live di `anlix.vercel.app`

---

## 🗄️ Setup MongoDB Atlas (Database)

### Step 1: Buat Cluster
1. Buka https://cloud.mongodb.com
2. Buat akun gratis
3. Create Cluster → **M0 FREE** tier
4. Pilih region terdekat (Singapore)

### Step 2: Setup Connection
1. **Database Access** → Add User:
   - Username: `anlix_user`
   - Password: (generate password kuat)
   - Role: `Read and write to any database`

2. **Network Access** → Add IP:
   - Klik **"Allow Access from Anywhere"** (0.0.0.0/0)

3. **Clusters** → **Connect** → **Connect your application**:
   - Salin connection string
   - Format: `mongodb+srv://anlix_user:PASSWORD@cluster0.xxxxx.mongodb.net/anlix?retryWrites=true&w=majority`

---

## 🔄 Update Railway dengan MongoDB URI

Kembali ke Railway → Variables:
- Update `MONGODB_URI` dengan connection string MongoDB Atlas

---

## ✅ Checklist Final

- [ ] Backend live di Railway
- [ ] MongoDB Atlas terhubung
- [ ] Frontend live di Vercel
- [ ] Environment variables sudah benar
- [ ] Test fitur login/register
- [ ] Test scraping anime/donghua

---

## 🐛 Troubleshooting

### Backend Error: MongoDB Connection
- Pastikan IP address diallow di MongoDB Atlas
- Cek MONGODB_URI sudah benar

### Frontend Error: API Not Found
- Pastikan NEXT_PUBLIC_API_URL mengarah ke Railway URL
- Jangan lupa `https://` di depan URL

### CORS Error
- Backend sudah dikonfigurasi untuk allow semua origin
- Jika masih error, tambahkan domain Vercel ke whitelist

---

## 📱 Domain Custom (Opsional)

### Vercel
1. Settings → Domains → Add
2. Masukkan domain kamu
3. Update DNS sesuai instruksi

### Railway
1. Settings → Custom Domain
2. Ikuti instruksi DNS

---

**Selamat! ANLIX kamu sudah online! 🎉**
