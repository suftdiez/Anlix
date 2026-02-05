'use client';

import { useState, useEffect } from 'react';
import { FiX, FiPlus, FiFolder, FiCheck } from 'react-icons/fi';
import { collectionsApi } from '@/lib/api';

interface Collection {
  _id: string;
  name: string;
  films: { filmId: string }[];
}

interface FilmData {
  filmId: string;
  title: string;
  slug: string;
  poster?: string;
  year?: string;
  quality?: string;
}

interface AddToCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  film: FilmData;
}

export default function AddToCollectionModal({ isOpen, onClose, film }: AddToCollectionModalProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCollections();
    }
  }, [isOpen]);

  const fetchCollections = async () => {
    try {
      setIsLoading(true);
      const response = await collectionsApi.getCollections();
      setCollections(response.data || []);
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
      const response = await collectionsApi.createCollection(newName.trim());
      setNewName('');
      setShowCreateForm(false);
      // Add film to the new collection immediately
      await handleAddToCollection(response.data._id);
      fetchCollections();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal membuat koleksi');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddToCollection = async (collectionId: string) => {
    try {
      setAddingTo(collectionId);
      setError(null);
      await collectionsApi.addToCollection(collectionId, film);
      setSuccessMessage('Film ditambahkan ke koleksi!');
      fetchCollections();
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Gagal menambahkan film';
      setError(errorMsg);
    } finally {
      setAddingTo(null);
    }
  };

  const isFilmInCollection = (collection: Collection) => {
    return collection.films?.some(f => f.filmId === film.filmId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-card border border-white/10 rounded-xl w-full max-w-md max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Tambah ke Koleksi</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {/* Success/Error Messages */}
          {successMessage && (
            <div className="bg-green-500/20 border border-green-500/50 text-green-300 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
              <FiCheck className="w-5 h-5" />
              {successMessage}
            </div>
          )}
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* Film Preview */}
          <div className="flex items-center gap-3 mb-4 p-3 bg-dark-bg rounded-lg">
            {film.poster && (
              <img src={film.poster} alt={film.title} className="w-12 h-16 object-cover rounded" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{film.title}</p>
              <p className="text-gray-400 text-sm">{film.year || 'Film'}</p>
            </div>
          </div>

          {/* Loading */}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-dark-bg rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Collections List */}
              {collections.length > 0 && (
                <div className="space-y-2 mb-4">
                  {collections.map((collection) => {
                    const alreadyAdded = isFilmInCollection(collection);
                    return (
                      <button
                        key={collection._id}
                        onClick={() => !alreadyAdded && handleAddToCollection(collection._id)}
                        disabled={alreadyAdded || addingTo === collection._id}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          alreadyAdded
                            ? 'bg-primary-500/20 border border-primary-500/50 cursor-default'
                            : 'bg-dark-bg hover:bg-white/10 border border-transparent'
                        }`}
                      >
                        <FiFolder className={`w-5 h-5 ${alreadyAdded ? 'text-primary-400' : 'text-gray-400'}`} />
                        <span className={`flex-1 text-left ${alreadyAdded ? 'text-primary-300' : 'text-white'}`}>
                          {collection.name}
                        </span>
                        {alreadyAdded ? (
                          <FiCheck className="w-5 h-5 text-primary-400" />
                        ) : addingTo === collection._id ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <FiPlus className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Create New Collection */}
              {showCreateForm ? (
                <form onSubmit={handleCreateCollection} className="space-y-3">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nama koleksi baru..."
                    className="w-full px-4 py-3 bg-dark-bg border border-white/10 rounded-lg text-white focus:border-primary-500 focus:outline-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating || !newName.trim()}
                      className="flex-1 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg disabled:opacity-50"
                    >
                      {isCreating ? 'Membuat...' : 'Buat & Tambah'}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 rounded-lg transition-colors"
                >
                  <FiPlus className="w-5 h-5" />
                  Buat Koleksi Baru
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
