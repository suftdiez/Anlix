# ANLIX - Anime & Donghua Streaming Website

![ANLIX](https://img.shields.io/badge/ANLIX-Streaming-DC143C?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square)
![Express](https://img.shields.io/badge/Express-4.x-green?style=flat-square)
![MongoDB](https://img.shields.io/badge/MongoDB-6.x-green?style=flat-square)

Website streaming anime dan donghua dengan tampilan modern dan fitur lengkap.

## ✨ Fitur

- 🎬 **Streaming Anime & Donghua** - Scraping dari Samehadaku & Anichin
- 🔍 **Pencarian** - Cari anime/donghua dengan mudah
- 🏷️ **Filter Genre** - Filter berdasarkan genre
- 👤 **Autentikasi** - Login & Register dengan JWT
- 🔖 **Bookmark** - Simpan anime/donghua favorit
- 📜 **Riwayat** - Lacak episode yang ditonton
- 💬 **Komentar** - Diskusi dengan pengguna lain
- 📱 **Responsive** - Tampilan optimal di semua device
- 🌙 **Dark Theme** - Tema gelap merah-emas yang elegan

## 🛠️ Tech Stack

### Frontend
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion
- SWR

### Backend
- Node.js + Express
- TypeScript
- MongoDB (Mongoose)
- Redis (Caching)
- Cheerio (Web Scraping)

## 📦 Instalasi

### Prerequisites
- Node.js 18+
- MongoDB
- Redis (optional, untuk caching)

### 1. Clone Repository
```bash
cd c:\Anlix
```

### 2. Install Backend Dependencies
```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies
```bash
cd ../frontend
npm install
```

### 4. Setup Environment

Backend `.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/anlix
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
```

Frontend `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### 5. Jalankan Aplikasi

**Backend** (Terminal 1):
```bash
cd backend
npm run dev
```

**Frontend** (Terminal 2):
```bash
cd frontend
npm run dev
```

### 6. Buka Browser
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 📁 Struktur Folder

```
c:\Anlix\
├── backend/
│   ├── src/
│   │   ├── config/         # Database & Redis config
│   │   ├── middleware/     # Auth middleware
│   │   ├── models/         # MongoDB models
│   │   ├── routes/         # API routes
│   │   ├── scrapers/       # Samehadaku & Anichin scrapers
│   │   └── index.ts        # Server entry point
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/
    ├── app/                # Next.js App Router
    │   ├── anime/          # Anime pages
    │   ├── donghua/        # Donghua pages
    │   ├── auth/           # Login/Register
    │   ├── search/         # Search page
    │   └── page.tsx        # Homepage
    ├── components/         # React components
    ├── lib/                # Utilities & API
    ├── package.json
    └── tailwind.config.ts
```

## 🔗 API Endpoints

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get profile

### Anime
- `GET /api/anime/latest` - Latest anime
- `GET /api/anime/ongoing` - Ongoing anime
- `GET /api/anime/search?q=` - Search anime
- `GET /api/anime/detail/:slug` - Anime detail
- `GET /api/anime/episode/:slug` - Episode streaming

### Donghua
- `GET /api/donghua/latest` - Latest donghua
- `GET /api/donghua/search?q=` - Search donghua
- `GET /api/donghua/detail/:slug` - Donghua detail
- `GET /api/donghua/episode/:slug` - Episode streaming

### User
- `GET /api/user/bookmarks` - Get bookmarks
- `POST /api/user/bookmarks` - Add bookmark
- `GET /api/user/history` - Get watch history
- `POST /api/user/comments` - Add comment

## 🎨 Theme Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Primary (Crimson) | `#DC143C` | Buttons, accents |
| Accent (Gold) | `#FFD700` | Highlights, ratings |
| Background | `#0a0a0a` | Main background |
| Card | `#141414` | Cards, modals |

## 📄 License

MIT License - Feel free to use this project for learning purposes.

---

Made with ❤️ for anime lovers
