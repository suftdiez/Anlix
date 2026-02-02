'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiSearch, FiTag, FiHash } from 'react-icons/fi';
import { novelApi } from '@/lib/api';

interface Tag {
  name: string;
  slug: string;
  count: number;
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await novelApi.getTags();
        if (response.success && response.data) {
          // Sort tags by count (descending) then by name
          const sortedTags = response.data.sort((a: Tag, b: Tag) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.name.localeCompare(b.name);
          });
          setTags(sortedTags);
          setFilteredTags(sortedTags);
        }
      } catch (error) {
        console.error('Error fetching tags:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTags();
  }, []);

  useEffect(() => {
    if (search) {
      const filtered = tags.filter(tag => 
        tag.name.toLowerCase().includes(search.toLowerCase())
      );
      setFilteredTags(filtered);
    } else {
      setFilteredTags(tags);
    }
  }, [search, tags]);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link href="/novel" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Terbaru
        </Link>
        <Link href="/novel/popular" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Populer
        </Link>
        <Link href="/novel/china" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          China
        </Link>
        <Link href="/novel/jepang" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Jepang
        </Link>
        <Link href="/novel/korea" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Korea
        </Link>
        <Link href="/novel/tamat" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Tamat
        </Link>
        <Link href="/novel/genre" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition">
          Genre
        </Link>
        <Link href="/novel/tag" className="px-4 py-2 bg-primary text-white rounded-lg">
          Tag
        </Link>
      </div>

      {/* Title */}
      <h1 className="text-2xl md:text-3xl font-bold text-white mb-6 flex items-center gap-3">
        <FiHash className="w-8 h-8 text-primary" />
        Semua Tag Novel
        {tags.length > 0 && (
          <span className="text-lg font-normal text-gray-400">({tags.length})</span>
        )}
      </h1>

      {/* Search */}
      <div className="relative max-w-md mb-6">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Cari tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Tags Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[...Array(24)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {filteredTags.map((tag) => (
            <Link
              key={tag.slug}
              href={`/novel/tag/${tag.slug}`}
              className="group flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-primary/20 border border-gray-700 hover:border-primary rounded-full transition-all"
            >
              <FiTag className="w-4 h-4 text-gray-400 group-hover:text-primary transition" />
              <span className="text-gray-300 group-hover:text-white transition capitalize">
                {tag.name}
              </span>
              {tag.count > 0 && (
                <span className="text-xs text-gray-500 group-hover:text-primary transition">
                  ({tag.count})
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredTags.length === 0 && (
        <div className="text-center py-12">
          <FiTag className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">
            {search ? `Tidak ada tag ditemukan untuk "${search}"` : 'Tidak ada tag tersedia'}
          </p>
        </div>
      )}
    </div>
  );
}
