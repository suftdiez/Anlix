import Link from 'next/link';
import { FiGithub, FiHeart } from 'react-icons/fi';
import Image from 'next/image';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    navigation: [
      { href: '/', label: 'Beranda' },
      { href: '/anime', label: 'Anime' },
      { href: '/donghua', label: 'Donghua' },
      { href: '/drama', label: 'Drama' },
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
              <Image 
                src="/logo.png" 
                alt="ANLIX Logo" 
                width={300} 
                height={100} 
                className="h-20 md:h-28 w-auto object-contain" 
              />
            </Link>
            <p className="mt-4 text-gray-400 max-w-md">
              Streaming anime, donghua, film, drama, komik, dan novel favoritmu dalam kualitas terbaik.
            </p>
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
        <div className="mt-12 pt-8 border-t border-white/5 flex justify-center items-center">
          <p className="text-gray-500 text-sm text-center">
            © {currentYear} ANLIX. All rights reserved.
          </p>
        </div>
      </div>

    </footer>
  );
}
