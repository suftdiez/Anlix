import Link from 'next/link';
import { FiGithub, FiHeart } from 'react-icons/fi';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    navigation: [
      { href: '/', label: 'Beranda' },
      { href: '/anime', label: 'Anime' },
      { href: '/donghua', label: 'Donghua' },
      { href: '/search', label: 'Pencarian' },
    ],
    animeGenres: [
      { href: '/anime/genre/action', label: 'Action' },
      { href: '/anime/genre/romance', label: 'Romance' },
      { href: '/anime/genre/comedy', label: 'Comedy' },
      { href: '/anime/genre/fantasy', label: 'Fantasy' },
    ],
    donghuaGenres: [
      { href: '/donghua/genre/action', label: 'Action' },
      { href: '/donghua/genre/cultivation', label: 'Cultivation' },
      { href: '/donghua/genre/martial-arts', label: 'Martial Arts' },
      { href: '/donghua/genre/fantasy', label: 'Fantasy' },
    ],
  };

  return (
    <footer className="bg-dark-700 border-t border-white/5 mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="inline-block">
              <span className="text-3xl font-display font-bold gradient-text">
                ANLIX
              </span>
            </Link>
            <p className="mt-4 text-gray-400 max-w-md">
              Tempat terbaik untuk menonton anime dan donghua subtitle Indonesia. 
              Nikmati koleksi lengkap dengan kualitas terbaik.
            </p>
            <div className="flex items-center gap-4 mt-6">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <FiGithub className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Navigation Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Navigasi</h4>
            <ul className="space-y-2">
              {footerLinks.navigation.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Anime Genre Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Genre Anime</h4>
            <ul className="space-y-2">
              {footerLinks.animeGenres.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Donghua Genre Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Genre Donghua</h4>
            <ul className="space-y-2">
              {footerLinks.donghuaGenres.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-accent transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">
            © {currentYear} ANLIX. All rights reserved.
          </p>
          <p className="text-gray-500 text-sm flex items-center gap-1">
            Made with <FiHeart className="w-4 h-4 text-primary" /> for anime lovers
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-dark-800 py-4">
        <div className="container mx-auto px-4">
          <p className="text-gray-600 text-xs text-center">
            Disclaimer: ANLIX tidak menyimpan file apapun di server kami. 
            Semua konten disediakan oleh pihak ketiga yang tidak terafiliasi.
          </p>
        </div>
      </div>
    </footer>
  );
}
