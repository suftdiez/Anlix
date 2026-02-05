'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlay, FiX } from 'react-icons/fi';
import { filmApi } from '@/lib/api';

interface TrailerData {
  key: string;
  name: string;
  type: string;
  url: string;
}

interface TrailerPlayerProps {
  slug: string;
  filmTitle: string;
}

export default function TrailerPlayer({ slug, filmTitle }: TrailerPlayerProps) {
  const [trailer, setTrailer] = useState<TrailerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const fetchTrailer = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        const response = await filmApi.getTrailer(slug);
        if (response.success && response.data) {
          setTrailer(response.data);
        }
      } catch (error) {
        console.log('Trailer not available for:', filmTitle);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrailer();
  }, [slug, filmTitle]);

  // Don't render anything if no trailer or still loading
  if (isLoading || hasError || !trailer) {
    return null;
  }

  return (
    <>
      {/* Watch Trailer Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="w-full mt-3 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all bg-red-600 hover:bg-red-700 text-white border border-red-500"
      >
        <FiPlay className="w-5 h-5" />
        Watch Trailer
      </button>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90"
            onClick={() => setIsModalOpen(false)}
          >
            {/* Close button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <FiX className="w-6 h-6 text-white" />
            </button>

            {/* Video container */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="relative w-full max-w-5xl aspect-video"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Trailer title */}
              <div className="absolute -top-10 left-0 text-white">
                <h3 className="text-lg font-semibold">{filmTitle}</h3>
                <p className="text-sm text-gray-400">{trailer.name}</p>
              </div>

              {/* YouTube iframe */}
              <iframe
                src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1&rel=0`}
                title={trailer.name}
                className="w-full h-full rounded-xl"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
