import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';
import { Navbar, Footer } from '@/components/layout';
import { AuthProvider } from '@/lib/auth';
import { Toaster } from 'react-hot-toast';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: {
    default: 'ANLIX - Streaming Anime & Donghua Sub Indo',
    template: '%s | ANLIX',
  },
  description: 'Nonton anime dan donghua subtitle Indonesia terlengkap dengan kualitas terbaik. Gratis dan update terbaru!',
  keywords: ['anime', 'donghua', 'streaming', 'sub indo', 'nonton anime', 'nonton donghua'],
  authors: [{ name: 'ANLIX' }],
  creator: 'ANLIX',
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    siteName: 'ANLIX',
    title: 'ANLIX - Streaming Anime & Donghua Sub Indo',
    description: 'Nonton anime dan donghua subtitle Indonesia terlengkap dengan kualitas terbaik.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ANLIX - Streaming Anime & Donghua Sub Indo',
    description: 'Nonton anime dan donghua subtitle Indonesia terlengkap dengan kualitas terbaik.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-screen flex flex-col">
        <AuthProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1a1a1a',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)',
              },
              success: {
                iconTheme: {
                  primary: '#DC143C',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
          <Navbar />
          <main className="flex-1 pt-16 md:pt-20">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
