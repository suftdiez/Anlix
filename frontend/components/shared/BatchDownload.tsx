'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiDownload, FiExternalLink, FiChevronDown, FiChevronUp, FiLoader } from 'react-icons/fi';
import { animeApi } from '@/lib/api';

interface DownloadLink {
  host: string;
  url: string;
}

interface DownloadBlock {
  title: string;
  quality: string;
  links: DownloadLink[];
}

interface BatchDownloadProps {
  animeTitle: string;
}

export default function BatchDownload({ animeTitle }: BatchDownloadProps) {
  const [downloads, setDownloads] = useState<DownloadBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchDownloads = useCallback(async () => {
    if (!animeTitle) return;
    setIsLoading(true);
    setError(false);

    try {
      const result = await animeApi.getBatchDownloads(animeTitle);
      if (result?.success && result.data?.downloads) {
        setDownloads(result.data.downloads);
      }
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [animeTitle]);

  useEffect(() => {
    fetchDownloads();
  }, [fetchDownloads]);

  // Don't render anything if no downloads found and not loading
  if (!isLoading && downloads.length === 0) return null;

  // Group downloads by quality
  const qualityOrder = ['1080p', '720p', '480p', '360p', 'Allreso', 'HD', 'Unknown'];
  const groupedByQuality = downloads.reduce((acc, block) => {
    const quality = block.quality || 'Unknown';
    if (!acc[quality]) acc[quality] = [];
    acc[quality].push(block);
    return acc;
  }, {} as Record<string, DownloadBlock[]>);

  const sortedQualities = Object.keys(groupedByQuality).sort((a, b) => {
    const aIdx = qualityOrder.indexOf(a);
    const bIdx = qualityOrder.indexOf(b);
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });

  const getQualityColor = (quality: string) => {
    const q = quality.toLowerCase();
    if (q.includes('1080')) return 'from-green-500/20 to-green-600/10 text-green-400 border-green-500/30';
    if (q.includes('720')) return 'from-blue-500/20 to-blue-600/10 text-blue-400 border-blue-500/30';
    if (q.includes('480')) return 'from-yellow-500/20 to-yellow-600/10 text-yellow-400 border-yellow-500/30';
    if (q.includes('360')) return 'from-gray-500/20 to-gray-600/10 text-gray-400 border-gray-500/30';
    if (q.includes('4k') || q.includes('2160')) return 'from-purple-500/20 to-purple-600/10 text-purple-400 border-purple-500/30';
    if (q.includes('allreso')) return 'from-indigo-500/20 to-indigo-600/10 text-indigo-400 border-indigo-500/30';
    return 'from-primary/20 to-primary/10 text-primary border-primary/30';
  };

  const getQualityBadgeColor = (quality: string) => {
    const q = quality.toLowerCase();
    if (q.includes('1080')) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (q.includes('720')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (q.includes('480')) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    if (q.includes('360')) return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    if (q.includes('4k') || q.includes('2160')) return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    if (q.includes('allreso')) return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
    return 'bg-primary/20 text-primary border-primary/30';
  };

  // Show preview (first 2 blocks) or all
  const displayedQualities = isExpanded ? sortedQualities : sortedQualities.slice(0, 2);
  const hasMore = sortedQualities.length > 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mt-10"
    >
      <h2 className="section-title flex items-center gap-3 mb-6">
        <span className="w-1 h-8 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full" />
        <FiDownload className="w-5 h-5 text-green-400" />
        Batch Download
        <span className="text-xs font-normal text-gray-500 ml-2">via Kusonime</span>
      </h2>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 bg-dark-card rounded-xl border border-white/5">
          <FiLoader className="w-5 h-5 text-primary animate-spin mr-3" />
          <span className="text-gray-400">Mencari link download batch...</span>
        </div>
      ) : error ? (
        <div className="text-center py-8 bg-dark-card rounded-xl border border-white/5">
          <p className="text-gray-500">Gagal memuat link download</p>
          <button
            onClick={fetchDownloads}
            className="mt-2 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            Coba lagi
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {displayedQualities.map((quality) => (
              <motion.div
                key={quality}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`rounded-xl border overflow-hidden bg-gradient-to-r ${getQualityColor(quality)}`}
              >
                {/* Quality header */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-md border ${getQualityBadgeColor(quality)}`}>
                    {quality}
                  </span>
                  <span className="text-sm text-gray-400">
                    {groupedByQuality[quality].length} sumber
                  </span>
                </div>

                {/* Download links */}
                <div className="p-4 space-y-2">
                  {groupedByQuality[quality].map((block, blockIdx) => (
                    <div key={blockIdx}>
                      {block.title && block.title !== animeTitle && groupedByQuality[quality].length > 1 && (
                        <p className="text-xs text-gray-500 mb-1.5 truncate">
                          {block.title.replace(/Download\s*/i, '').replace(/Subtitle Indonesia/gi, '').trim()}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {block.links.map((link, linkIdx) => (
                          <a
                            key={linkIdx}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dark-bg/60 hover:bg-dark-bg/90 rounded-lg text-sm text-gray-300 hover:text-white border border-white/5 hover:border-white/20 transition-all group"
                          >
                            <FiExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                            {link.host}
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Show more / less toggle */}
          {hasMore && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-400 hover:text-white bg-dark-card rounded-xl border border-white/5 hover:border-white/20 transition-all"
            >
              {isExpanded ? (
                <>
                  <FiChevronUp className="w-4 h-4" />
                  Tampilkan lebih sedikit
                </>
              ) : (
                <>
                  <FiChevronDown className="w-4 h-4" />
                  Lihat semua kualitas ({sortedQualities.length})
                </>
              )}
            </button>
          )}

          {/* Attribution */}
          <p className="text-[11px] text-gray-600 text-center mt-2">
            Sumber: kusonime.com · Link download mengarah ke situs eksternal
          </p>
        </div>
      )}
    </motion.div>
  );
}
