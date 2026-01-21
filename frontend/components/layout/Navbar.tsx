'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSearch, FiMenu, FiX, FiUser, FiLogOut, FiBookmark, FiClock } from 'react-icons/fi';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  const navLinks = [
    { href: '/', label: 'Beranda' },
    { href: '/anime', label: 'Anime' },
    { href: '/donghua', label: 'Donghua' },
    { href: '/drama', label: 'Drama' },
    { href: '/anime/genre', label: 'Genre Anime' },
    { href: '/donghua/genre', label: 'Genre Donghua' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-dark-600/80 backdrop-blur-lg border-b border-white/5">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl md:text-3xl font-display font-bold gradient-text">
              ANLIX
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="nav-link font-medium"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            {/* Search Button */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Search"
            >
              <FiSearch className="w-5 h-5" />
            </button>

            {/* User Menu */}
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold text-sm">
                    {user?.username?.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-sm font-medium">
                    {user?.username}
                  </span>
                </button>

                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 top-full mt-2 w-48 bg-dark-card border border-white/10 rounded-xl shadow-xl overflow-hidden"
                    >
                      <Link
                        href="/profile"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <FiUser className="w-4 h-4" />
                        <span>Profil</span>
                      </Link>
                      <Link
                        href="/profile/bookmarks"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <FiBookmark className="w-4 h-4" />
                        <span>Bookmark</span>
                      </Link>
                      <Link
                        href="/profile/history"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <FiClock className="w-4 h-4" />
                        <span>Riwayat</span>
                      </Link>
                      <button
                        onClick={() => {
                          logout();
                          setIsUserMenuOpen(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/5"
                      >
                        <FiLogOut className="w-4 h-4" />
                        <span>Keluar</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                href="/auth/login"
                className="hidden sm:flex btn-primary text-sm py-2"
              >
                Masuk
              </Link>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(true)}
              className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Menu"
            >
              <FiMenu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setIsMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-72 bg-dark-card border-l border-white/10 z-50 md:hidden"
            >
              <div className="p-4 flex justify-between items-center border-b border-white/10">
                <span className="text-xl font-display font-bold gradient-text">
                  Menu
                </span>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 text-gray-400 hover:text-white"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>
              <nav className="p-4 space-y-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="block px-4 py-3 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
                {!isAuthenticated && (
                  <Link
                    href="/auth/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="block px-4 py-3 rounded-lg bg-primary text-white font-semibold text-center mt-4"
                  >
                    Masuk
                  </Link>
                )}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Search Modal */}
      <AnimatePresence>
        {isSearchOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
              onClick={() => setIsSearchOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50"
            >
              <form onSubmit={handleSearch} className="relative">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari anime, donghua, atau drama..."
                  className="w-full pl-12 pr-4 py-4 bg-dark-card border border-white/10 rounded-xl text-white text-lg placeholder:text-gray-500 focus:outline-none focus:border-primary/50"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
