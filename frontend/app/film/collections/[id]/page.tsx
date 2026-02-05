'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiEdit2, FiTrash2, FiFilm } from 'react-icons/fi';
import { collectionsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AnimeCard } from '@/components';

interface FilmItem {
  filmId: string;
  title: string;
  slug: string;
  poster: string;
  year?: string;
  quality?: string;
  addedAt: string;
}

interface Collection {
  _id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  films: FilmItem[];
  createdAt: string;
  updatedAt: string;
}

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const collectionId = params.id as string;

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/auth/login?redirect=/film/collections');
      return;
    }

    fetchCollection();
  }, [user, authLoading, collectionId, router]);

  const fetchCollection = async () => {
    try {
      setIsLoading(true);
      const response = await collectionsApi.getCollection(collectionId);
      setCollection(response.data);
      setEditName(response.data.name);
      setEditDescription(response.data.description || '');
      setError(null);
    } catch (err) {
      console.error('Failed to fetch collection:', err);
      setError('Koleksi tidak ditemukan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCollection = async () => {
    if (!editName.trim()) return;

    try {
      await collectionsApi.updateCollection(collectionId, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      setIsEditing(false);
      fetchCollection();
    } catch (err) {
      console.error('Failed to update collection:', err);
      setError('Gagal mengupdate koleksi');
    }
  };

  const handleRemoveFilm = async (filmId: string, title: string) => {
    if (!confirm(`Hapus "${title}" dari koleksi?`)) return;

    try {
      await collectionsApi.removeFromCollection(collectionId, filmId);
      fetchCollection();
    } catch (err) {
      console.error('Failed to remove film:', err);
      setError('Gagal menghapus film');
    }
  };

  const handleDeleteCollection = async () => {
    if (!collection) return;
    if (!confirm(`Hapus koleksi "${collection.name}"? Semua film di dalamnya akan dihapus.`)) return;

    try {
      await collectionsApi.deleteCollection(collectionId);
      router.push('/film/collections');
    } catch (err) {
      console.error('Failed to delete collection:', err);
      setError('Gagal menghapus koleksi');
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg pt-24 pb-12 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-dark-card rounded mb-6" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="aspect-[2/3] bg-dark-card rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen bg-dark-bg pt-24 pb-12 px-4 md:px-8">
        <div className="max-w-6xl mx-auto text-center py-16">
          <p className="text-red-400 mb-4">{error || 'Koleksi tidak ditemukan'}</p>
          <Link href="/film/collections" className="text-primary-400 hover:underline">
            Kembali ke daftar koleksi
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-start gap-4">
            <Link href="/film/collections" className="p-2 bg-dark-card rounded-lg hover:bg-white/10 transition-colors mt-1">
              <FiArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              {isEditing ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-2xl font-bold bg-dark-bg border border-white/10 rounded-lg px-3 py-1 text-white focus:border-primary-500 focus:outline-none"
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Deskripsi..."
                    className="w-full bg-dark-bg border border-white/10 rounded-lg px-3 py-2 text-gray-400 focus:border-primary-500 focus:outline-none resize-none"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdateCollection}
                      className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm"
                    >
                      Simpan
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-2xl md:text-3xl font-display font-bold text-white mb-1">
                    {collection.name}
                  </h1>
                  {collection.description && (
                    <p className="text-gray-400">{collection.description}</p>
                  )}
                  <p className="text-gray-500 text-sm mt-2">
                    {collection.films.length} film
                  </p>
                </>
              )}
            </div>
          </div>
          {!isEditing && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 bg-dark-card hover:bg-white/10 rounded-lg transition-colors"
              >
                <FiEdit2 className="w-5 h-5" />
              </button>
              <button
                onClick={handleDeleteCollection}
                className="p-2 bg-dark-card hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
              >
                <FiTrash2 className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Films Grid */}
        {collection.films.length === 0 ? (
          <div className="text-center py-16">
            <FiFilm className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-400 mb-2">Koleksi masih kosong</h2>
            <p className="text-gray-500 mb-6">Tambahkan film dari halaman detail film</p>
            <Link href="/film" className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg inline-block">
              Jelajahi Film
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {collection.films.map((film, index) => (
              <div key={film.filmId} className="relative group">
                <AnimeCard
                  id={film.filmId}
                  title={film.title}
                  slug={film.slug}
                  poster={film.poster}
                  type={film.quality || 'HD'}
                  contentType="film"
                  index={index}
                />
                <button
                  onClick={() => handleRemoveFilm(film.filmId, film.title)}
                  className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
