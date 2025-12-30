'use client';

import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

interface PaginationProps {
  currentPage: number;
  hasNext: boolean;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export default function Pagination({
  currentPage,
  hasNext,
  onPageChange,
  isLoading = false,
}: PaginationProps) {
  return (
    <div className="flex items-center justify-center gap-4 mt-8">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1 || isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <FiChevronLeft className="w-5 h-5" />
        <span className="hidden sm:inline">Sebelumnya</span>
      </button>

      <div className="flex items-center gap-2">
        <span className="px-4 py-2 bg-primary/20 border border-primary/30 rounded-lg text-primary font-semibold">
          {currentPage}
        </span>
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!hasNext || isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <span className="hidden sm:inline">Selanjutnya</span>
        <FiChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
