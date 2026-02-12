'use client';

import { useEffect, useState } from 'react';
import { FiStar, FiThumbsUp, FiTrash2, FiEdit2, FiUser } from 'react-icons/fi';
import { userApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import toast from 'react-hot-toast';

interface Review {
  _id: string;
  userId: {
    _id: string;
    username: string;
    avatar?: string;
  };
  rating: number;
  content: string;
  likes: number;
  likedBy: string[];
  createdAt: string;
}

interface ContentReviewsProps {
  contentId: string;
  contentType: 'film' | 'anime' | 'donghua';
  contentTitle: string;
}

export default function ContentReviews({ contentId, contentType, contentTitle }: ContentReviewsProps) {
  const { isAuthenticated, user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [ratingDistribution, setRatingDistribution] = useState<Record<number, number>>({});
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewContent, setReviewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userReviewId, setUserReviewId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Content type labels
  const contentLabel = contentType === 'anime' ? 'anime' : contentType === 'donghua' ? 'donghua' : 'film';

  // Fetch reviews
  useEffect(() => {
    const fetchReviews = async () => {
      setIsLoading(true);
      try {
        const data = await userApi.getReviews(contentId);
        if (data.success) {
          setReviews(data.data);
          setAverageRating(parseFloat(data.averageRating) || 0);
          setTotalReviews(data.total);
          setRatingDistribution(data.ratingDistribution || {});
        }
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReviews();
  }, [contentId]);

  // Check if user has reviewed
  useEffect(() => {
    const checkUserReview = async () => {
      if (!isAuthenticated) return;
      try {
        const data = await userApi.getUserReview(contentId);
        if (data.hasReviewed && data.review) {
          setUserReviewId(data.review._id);
          setUserRating(data.review.rating);
          setReviewContent(data.review.content);
        }
      } catch (error) {
        console.error('Failed to check user review:', error);
      }
    };

    checkUserReview();
  }, [isAuthenticated, contentId]);

  const handleSubmitReview = async () => {
    if (!isAuthenticated) {
      toast.error('Silakan login untuk memberikan review');
      return;
    }

    if (userRating === 0) {
      toast.error('Silakan pilih rating');
      return;
    }

    if (reviewContent.trim().length < 10) {
      toast.error('Review minimal 10 karakter');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await userApi.addReview({
        contentId,
        contentType,
        rating: userRating,
        content: reviewContent.trim(),
      });

      if (data.success) {
        toast.success(userReviewId ? 'Review diperbarui!' : 'Review berhasil dikirim!');
        setShowForm(false);
        setIsEditing(false);
        setUserReviewId(data.data._id);
        
        // Refresh reviews
        const reviewsData = await userApi.getReviews(contentId);
        if (reviewsData.success) {
          setReviews(reviewsData.data);
          setAverageRating(parseFloat(reviewsData.averageRating) || 0);
          setTotalReviews(reviewsData.total);
          setRatingDistribution(reviewsData.ratingDistribution || {});
        }
      }
    } catch (error) {
      toast.error('Gagal mengirim review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLikeReview = async (reviewId: string) => {
    if (!isAuthenticated) {
      toast.error('Silakan login untuk menyukai review');
      return;
    }

    try {
      const data = await userApi.likeReview(reviewId);
      if (data.success) {
        setReviews(prev => prev.map(r => {
          if (r._id === reviewId) {
            return {
              ...r,
              likes: data.likes,
              likedBy: data.liked 
                ? [...r.likedBy, user?.id || '']
                : r.likedBy.filter(id => id !== user?.id),
            };
          }
          return r;
        }));
      }
    } catch (error) {
      toast.error('Gagal menyukai review');
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Hapus review ini?')) return;

    try {
      const data = await userApi.deleteReview(reviewId);
      if (data.success) {
        toast.success('Review dihapus');
        setReviews(prev => prev.filter(r => r._id !== reviewId));
        setUserReviewId(null);
        setUserRating(0);
        setReviewContent('');
        setTotalReviews(prev => prev - 1);
      }
    } catch (error) {
      toast.error('Gagal menghapus review');
    }
  };

  const renderStars = (rating: number, interactive = false, size = 'w-5 h-5') => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && setUserRating(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            className={`${interactive ? 'cursor-pointer' : 'cursor-default'} transition-colors`}
          >
            <FiStar
              className={`${size} ${
                star <= (interactive ? (hoverRating || userRating) : rating)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-500'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="mt-8">
      {/* Header with Average Rating */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FiStar className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            Ulasan & Rating
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {totalReviews} ulasan untuk {contentTitle}
          </p>
        </div>

        {/* Average Rating Display */}
        {totalReviews > 0 && (
          <div className="flex items-center gap-4 bg-gray-800/50 rounded-xl px-4 py-3">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-400">{averageRating.toFixed(1)}</div>
              <div className="text-xs text-gray-400">dari 5</div>
            </div>
            <div className="flex flex-col gap-1">
              {[5, 4, 3, 2, 1].map((star) => (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-gray-400">{star}</span>
                  <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 rounded-full"
                      style={{
                        width: `${totalReviews > 0 ? ((ratingDistribution[star] || 0) / totalReviews) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="w-4 text-gray-500">{ratingDistribution[star] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Write Review Button */}
      {isAuthenticated && !showForm && !isEditing && (
        <button
          onClick={() => {
            setShowForm(true);
            if (userReviewId) setIsEditing(true);
          }}
          className="mb-6 px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          {userReviewId ? (
            <>
              <FiEdit2 className="w-4 h-4" />
              Edit Review Saya
            </>
          ) : (
            <>
              <FiStar className="w-4 h-4" />
              Tulis Review
            </>
          )}
        </button>
      )}

      {/* Review Form */}
      {showForm && (
        <div className="bg-gray-800/50 rounded-xl p-5 mb-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">
            {isEditing ? 'Edit Review' : 'Tulis Review Anda'}
          </h3>
          
          {/* Rating Input */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Rating</label>
            <div className="flex items-center gap-3">
              {renderStars(userRating, true, 'w-8 h-8')}
              <span className="text-gray-400 text-sm">
                {userRating > 0 && `${userRating}/5`}
              </span>
            </div>
          </div>

          {/* Review Content */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Ulasan</label>
            <textarea
              value={reviewContent}
              onChange={(e) => setReviewContent(e.target.value)}
              placeholder={`Bagikan pendapat Anda tentang ${contentLabel} ini...`}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary resize-none"
              rows={4}
              maxLength={2000}
            />
            <div className="text-xs text-gray-500 mt-1 text-right">
              {reviewContent.length}/2000
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSubmitReview}
              disabled={isSubmitting}
              className="px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Mengirim...' : (isEditing ? 'Perbarui' : 'Kirim Review')}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setIsEditing(false);
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Login Prompt */}
      {!isAuthenticated && (
        <div className="bg-gray-800/30 rounded-xl p-6 mb-6 text-center border border-gray-700/50">
          <p className="text-gray-400 mb-3">Login untuk memberikan rating dan review</p>
          <a
            href="/auth/login"
            className="inline-block px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg font-medium transition-colors"
          >
            Login
          </a>
        </div>
      )}

      {/* Reviews List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-gray-800/30 rounded-xl p-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-gray-700 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-700 rounded w-32 mb-2" />
                  <div className="h-3 bg-gray-700 rounded w-20 mb-3" />
                  <div className="h-16 bg-gray-700 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review._id}
              className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50"
            >
              <div className="flex gap-3">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {review.userId.avatar ? (
                    <img
                      src={review.userId.avatar}
                      alt={review.userId.username}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                      <FiUser className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="font-medium text-white">
                        {review.userId.username}
                      </span>
                      <span className="text-gray-500 text-sm ml-2">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>
                    
                    {/* Delete button for own review */}
                    {user?.id === review.userId._id && (
                      <button
                        onClick={() => handleDeleteReview(review._id)}
                        className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                        title="Hapus review"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Rating */}
                  <div className="mb-2">
                    {renderStars(review.rating, false, 'w-4 h-4')}
                  </div>

                  {/* Review Text */}
                  <p className="text-gray-300 text-sm whitespace-pre-wrap break-words">
                    {review.content}
                  </p>

                  {/* Like Button */}
                  <button
                    onClick={() => handleLikeReview(review._id)}
                    className={`mt-3 flex items-center gap-1.5 text-sm transition-colors ${
                      review.likedBy.includes(user?.id || '')
                        ? 'text-primary'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <FiThumbsUp className={`w-4 h-4 ${review.likedBy.includes(user?.id || '') ? 'fill-current' : ''}`} />
                    <span>{review.likes}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-800/20 rounded-xl">
          <FiStar className="w-12 h-12 mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400">Belum ada review</p>
          <p className="text-gray-500 text-sm mt-1">Jadilah yang pertama memberikan review!</p>
        </div>
      )}
    </div>
  );
}
