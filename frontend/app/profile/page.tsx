'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { userApi } from '@/lib/api';
import { FiBookmark, FiClock, FiSettings, FiLogOut, FiEdit3 } from 'react-icons/fi';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({
    bookmarks: 0,
    history: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        if (!user) return;
        const [bookmarksRes, historyRes] = await Promise.all([
          userApi.getBookmarks(1, 1),
          userApi.getHistory(1, 1),
        ]);
        
        setStats({
          bookmarks: bookmarksRes?.total || 0,
          history: historyRes?.total || 0,
        });
      } catch (error) {
        console.error('Failed to fetch user stats', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center">
        <div className="w-8 h-8 md:w-12 md:h-12 border-4 border-white/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-dark-bg text-white pb-20">
      {/* Header Banner Background */}
      <div className="h-48 md:h-64 bg-dark-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 relative -mt-24 md:-mt-32">
        <div className="max-w-4xl mx-auto">
          {/* User Profile Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-dark-card rounded-2xl p-6 md:p-8 border border-white/5 shadow-2xl flex flex-col md:flex-row items-center md:items-start gap-6 relative"
          >
            {/* Avatar */}
            <div className="relative group">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-dark-card overflow-hidden bg-dark-bg shadow-xl flex-shrink-0">
                {user.avatar ? (
                  <Image 
                    src={user.avatar} 
                    alt={user.username} 
                    fill 
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900 border-4 border-gray-800 text-gray-200 text-3xl md:text-5xl font-bold font-outfit uppercase shadow-inner">
                    {user.username.charAt(0)}
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left mt-2 md:mt-4">
              <h1 className="text-2xl md:text-3xl font-bold font-outfit text-white mb-1">
                {user.username}
              </h1>
              <p className="text-gray-400 text-sm md:text-base mb-4">{user.email}</p>
              <div className="inline-flex items-center px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-full text-xs font-medium">
                Member ANLIX
              </div>
            </div>

            {/* Quick Action */}
            <div className="absolute top-4 right-4 md:static md:mt-4">
              <button 
                onClick={logout}
                className="p-2 md:px-4 md:py-2 flex items-center gap-2 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-xl transition-colors border border-white/5"
                title="Keluar"
              >
                <FiLogOut className="w-5 h-5" />
                <span className="hidden md:inline font-medium">Keluar</span>
              </button>
            </div>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-dark-card rounded-2xl p-6 border border-white/5 flex flex-col items-center justify-center"
            >
              <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
                <FiBookmark className="w-6 h-6" />
              </div>
              <h3 className="text-3xl font-bold font-outfit text-white mb-1">
                {isLoading ? '-' : stats.bookmarks}
              </h3>
              <p className="text-gray-400 text-sm text-center">Anime Disimpan</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-dark-card rounded-2xl p-6 border border-white/5 flex flex-col items-center justify-center"
            >
              <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
                <FiClock className="w-6 h-6" />
              </div>
              <h3 className="text-3xl font-bold font-outfit text-white mb-1">
                {isLoading ? '-' : stats.history}
              </h3>
              <p className="text-gray-400 text-sm text-center">Riwayat Tontonan</p>
            </motion.div>
          </div>

          {/* Menu Options */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 bg-dark-card rounded-2xl border border-white/5 overflow-hidden"
          >
            <div className="p-4 border-b border-white/5">
              <h2 className="text-lg font-bold font-outfit text-white">Menu Akun</h2>
            </div>
            <div className="flex flex-col">
              <Link 
                href="/profile/history"
                className="flex items-center justify-between p-4 md:p-5 hover:bg-white/5 transition-colors border-b border-white/5 group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-primary transition-colors">
                    <FiClock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white group-hover:text-primary transition-colors">Riwayat Tontonan</h3>
                    <p className="text-sm text-gray-400">Lanjutkan tontonan kamu yang tertunda</p>
                  </div>
                </div>
              </Link>

              <Link 
                href="/profile/bookmarks"
                className="flex items-center justify-between p-4 md:p-5 hover:bg-white/5 transition-colors border-b border-white/5 group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-primary transition-colors">
                    <FiBookmark className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white group-hover:text-primary transition-colors">Daftar Simpanan</h3>
                    <p className="text-sm text-gray-400">Koleksi anime dan donghua favoritmu</p>
                  </div>
                </div>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
