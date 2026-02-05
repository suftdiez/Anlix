'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiPlus, FiFolder, FiFilm, FiTrash2, FiArrowLeft, FiLock, FiGlobe } from 'react-icons/fi';
import { collectionsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Collection {
  _id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  films: { filmId: string }[];
  createdAt: string;
  updatedAt: string;
}

export default function CollectionsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/auth/login?redirect=/film/collections');
      return;
    }

    fetchCollections();
  }, [user, authLoading, router]);

  const fetchCollections = async () => {
    try {
      setIsLoading(true);
      const response = await collectionsApi.getCollections();
      setCollections(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch collections:', err);
      setError('Gagal memuat koleksi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setIsCreating(true);
      await collectionsApi.createCollection(newName.trim(), newDescription.trim());
      setNewName('');
      setNewDescription('');
      setShowCreateModal(false);
      fetchCollections();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal membuat koleksi');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCollection = async (id: string, name: string) => {
    if (!confirm(`Hapus koleksi "${name}"?`)) return;

    try {
      await collectionsApi.deleteCollection(id);
      fetchCollections();
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 bg-dark-card rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/film" className="p-2 bg-dark-card rounded-lg hover:bg-white/10 transition-colors">
              <FiArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-white">
                Koleksi Film
              </h1>
              <p className="text-gray-400 text-sm">Kelola playlist film favoritmu</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
          >
            <FiPlus className="w-5 h-5" />
            <span className="hidden sm:inline">Buat Koleksi</span>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Collections Grid */}
        {collections.length === 0 ? (
          <div className="text-center py-16">
            <FiFolder className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-400 mb-2">Belum ada koleksi</h2>
            <p className="text-gray-500 mb-6">Buat koleksi pertamamu untuk menyimpan film favorit</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              Buat Koleksi Pertama
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map((collection) => (
              <div
                key={collection._id}
                className="bg-dark-card border border-white/10 rounded-lg p-4 hover:border-primary-500/50 transition-colors group"
              >
                <Link href={`/film/collections/${collection._id}`} className="block">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-primary-500/20 rounded-lg">
                      <FiFolder className="w-6 h-6 text-primary-400" />
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      {collection.isPublic ? (
                        <FiGlobe className="w-4 h-4" />
                      ) : (
                        <FiLock className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-primary-400 transition-colors">
                    {collection.name}
                  </h3>
                  {collection.description && (
                    <p className="text-gray-400 text-sm mb-3 line-clamp-2">{collection.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <FiFilm className="w-4 h-4" />
                    <span>{collection.films?.length || 0} film</span>
                  </div>
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    handleDeleteCollection(collection._id, collection.name);
                  }}
                  className="mt-3 w-full py-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100"
                >
                  <FiTrash2 className="w-4 h-4" />
                  Hapus
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-card border border-white/10 rounded-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-4">Buat Koleksi Baru</h2>
              <form onSubmit={handleCreateCollection}>
                <div className="mb-4">
                  <label className="block text-gray-400 text-sm mb-2">Nama Koleksi</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Contoh: Film Favorit"
                    className="w-full px-4 py-3 bg-dark-bg border border-white/10 rounded-lg text-white focus:border-primary-500 focus:outline-none"
                    required
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-gray-400 text-sm mb-2">Deskripsi (opsional)</label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Deskripsi singkat koleksi..."
                    rows={3}
                    className="w-full px-4 py-3 bg-dark-bg border border-white/10 rounded-lg text-white focus:border-primary-500 focus:outline-none resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !newName.trim()}
                    className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isCreating ? 'Membuat...' : 'Buat'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
