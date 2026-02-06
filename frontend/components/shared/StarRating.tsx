'use client';

import { FiStar } from 'react-icons/fi';

interface StarRatingProps {
  rating: number; // Rating out of 10
  maxStars?: number;
  showNumber?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function StarRating({ 
  rating, 
  maxStars = 5, 
  showNumber = true,
  size = 'sm' 
}: StarRatingProps) {
  // Convert rating from 0-10 scale to 0-5 stars
  const normalizedRating = (rating / 10) * maxStars;
  const fullStars = Math.floor(normalizedRating);
  const partialFill = normalizedRating - fullStars;
  const emptyStars = maxStars - fullStars - (partialFill > 0 ? 1 : 0);

  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const starSize = sizeClasses[size];

  return (
    <div className="flex items-center gap-1">
      {/* Full Stars */}
      {[...Array(fullStars)].map((_, i) => (
        <FiStar 
          key={`full-${i}`} 
          className={`${starSize} text-yellow-400 fill-yellow-400`} 
        />
      ))}
      
      {/* Partial Star */}
      {partialFill > 0 && (
        <div className="relative">
          {/* Empty star background */}
          <FiStar className={`${starSize} text-gray-500`} />
          {/* Filled portion overlay */}
          <div 
            className="absolute inset-0 overflow-hidden" 
            style={{ width: `${partialFill * 100}%` }}
          >
            <FiStar className={`${starSize} text-yellow-400 fill-yellow-400`} />
          </div>
        </div>
      )}
      
      {/* Empty Stars */}
      {[...Array(Math.max(0, emptyStars))].map((_, i) => (
        <FiStar 
          key={`empty-${i}`} 
          className={`${starSize} text-gray-500`} 
        />
      ))}
      
      {/* Rating Number */}
      {showNumber && (
        <span className="text-yellow-400 text-xs font-medium ml-0.5">
          {rating.toFixed(2)}
        </span>
      )}
    </div>
  );
}
