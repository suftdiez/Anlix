'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMessageCircle, FiHeart, FiTrash2, FiCornerDownRight, FiSend, FiUser } from 'react-icons/fi';
import { userApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import toast from 'react-hot-toast';

interface Comment {
  _id: string;
  userId: {
    _id: string;
    username: string;
    avatar?: string;
  };
  content: string;
  likes: number;
  likedBy: string[];
  createdAt: string;
  replies?: Comment[];
}

interface CommentsSectionProps {
  contentId: string;
  contentType: 'anime' | 'donghua';
  episodeId?: string;
  episodeTitle?: string;
}

export default function CommentsSection({ 
  contentId, 
  contentType, 
  episodeId,
  episodeTitle 
}: CommentsSectionProps) {
  const { user, isAuthenticated } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchComments = useCallback(async (pageNum = 1) => {
    try {
      const result = await userApi.getComments(contentId, pageNum, episodeId);
      if (pageNum === 1) {
        setComments(result.data || []);
      } else {
        setComments(prev => [...prev, ...(result.data || [])]);
      }
      setHasMore(result.hasMore || false);
      setTotal(result.total || 0);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [contentId, episodeId]);

  useEffect(() => {
    fetchComments(1);
  }, [fetchComments]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !isAuthenticated) return;

    setIsSubmitting(true);
    try {
      await userApi.addComment({
        contentId,
        contentType,
        episodeId,
        content: newComment.trim(),
      });
      setNewComment('');
      // Refresh comments
      await fetchComments(1);
      setPage(1);
      toast.success('Komentar berhasil ditambahkan!');
    } catch (err) {
      console.error('Failed to add comment:', err);
      toast.error('Gagal menambahkan komentar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim() || !isAuthenticated) return;

    setIsSubmitting(true);
    try {
      await userApi.addComment({
        contentId,
        contentType,
        episodeId,
        content: replyContent.trim(),
        parentId,
      });
      setReplyContent('');
      setReplyTo(null);
      await fetchComments(1);
      setPage(1);
      toast.success('Balasan berhasil ditambahkan!');
    } catch (err) {
      console.error('Failed to add reply:', err);
      toast.error('Gagal menambahkan balasan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (commentId: string) => {
    if (!isAuthenticated) {
      toast.error('Login untuk like komentar');
      return;
    }

    try {
      const result = await userApi.likeComment(commentId);
      // Update local state
      setComments(prev => prev.map(c => {
        if (c._id === commentId) {
          return {
            ...c,
            likes: result.likes,
            likedBy: result.liked 
              ? [...c.likedBy, user?.id || '']
              : c.likedBy.filter(id => id !== user?.id),
          };
        }
        // Check replies
        if (c.replies) {
          return {
            ...c,
            replies: c.replies.map(r => {
              if (r._id === commentId) {
                return {
                  ...r,
                  likes: result.likes,
                  likedBy: result.liked 
                    ? [...r.likedBy, user?.id || '']
                    : r.likedBy.filter(id => id !== user?.id),
                };
              }
              return r;
            }),
          };
        }
        return c;
      }));
    } catch (err) {
      console.error('Failed to like comment:', err);
      toast.error('Gagal like komentar');
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Yakin ingin menghapus komentar ini?')) return;

    try {
      await userApi.deleteComment(commentId);
      await fetchComments(1);
      setPage(1);
      toast.success('Komentar berhasil dihapus');
    } catch (err) {
      console.error('Failed to delete comment:', err);
      toast.error('Gagal menghapus komentar');
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchComments(nextPage);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Baru saja';
    if (minutes < 60) return `${minutes} menit yang lalu`;
    if (hours < 24) return `${hours} jam yang lalu`;
    if (days < 7) return `${days} hari yang lalu`;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => {
    const isLiked = user && comment.likedBy.includes(user.id);
    const isOwner = user && comment.userId._id === user.id;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${isReply ? 'ml-8 pl-4 border-l-2 border-white/10' : ''}`}
      >
        <div className="flex gap-3 py-4">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {comment.userId.avatar ? (
              <Image
                src={comment.userId.avatar}
                alt={comment.userId.username}
                width={40}
                height={40}
                className="object-cover"
              />
            ) : (
              <FiUser className="w-5 h-5 text-primary" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-white">{comment.userId.username}</span>
              <span className="text-xs text-gray-500">{formatDate(comment.createdAt)}</span>
            </div>
            <p className="text-gray-300 text-sm whitespace-pre-wrap break-words">
              {comment.content}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-4 mt-2">
              <button
                onClick={() => handleLike(comment._id)}
                className={`flex items-center gap-1 text-xs transition-colors ${
                  isLiked ? 'text-red-400' : 'text-gray-500 hover:text-red-400'
                }`}
              >
                <FiHeart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                <span>{comment.likes || 0}</span>
              </button>

              {!isReply && isAuthenticated && (
                <button
                  onClick={() => setReplyTo(replyTo === comment._id ? null : comment._id)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary transition-colors"
                >
                  <FiCornerDownRight className="w-4 h-4" />
                  <span>Balas</span>
                </button>
              )}

              {isOwner && (
                <button
                  onClick={() => handleDelete(comment._id)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
                >
                  <FiTrash2 className="w-4 h-4" />
                  <span>Hapus</span>
                </button>
              )}
            </div>

            {/* Reply Input */}
            <AnimatePresence>
              {replyTo === comment._id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3"
                >
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder={`Balas ke ${comment.userId.username}...`}
                      className="flex-1 px-3 py-2 bg-dark-card border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-primary/50 focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmitReply(comment._id);
                        }
                      }}
                    />
                    <button
                      onClick={() => handleSubmitReply(comment._id)}
                      disabled={!replyContent.trim() || isSubmitting}
                      className="px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/80 disabled:opacity-50 transition-colors"
                    >
                      <FiSend className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map((reply) => (
              <CommentItem key={reply._id} comment={reply} isReply />
            ))}
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="mt-8 bg-dark-card border border-white/10 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <FiMessageCircle className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-white">
          Komentar
          {total > 0 && <span className="text-gray-400 font-normal ml-2">({total})</span>}
        </h3>
        {episodeTitle && (
          <span className="text-sm text-gray-400 ml-2">• {episodeTitle}</span>
        )}
      </div>

      {/* Comment Input */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmitComment} className="mb-6">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              {user?.avatar ? (
                <Image
                  src={user.avatar}
                  alt={user.username}
                  width={40}
                  height={40}
                  className="rounded-full object-cover"
                />
              ) : (
                <FiUser className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Tulis komentar..."
                rows={3}
                maxLength={1000}
                className="w-full px-4 py-3 bg-dark border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-primary/50 focus:outline-none resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">
                  {newComment.length}/1000
                </span>
                <button
                  type="submit"
                  disabled={!newComment.trim() || isSubmitting}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/80 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <FiSend className="w-4 h-4" />
                  Kirim
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-6 p-4 bg-dark border border-white/10 rounded-xl text-center">
          <p className="text-gray-400 text-sm">
            <a href="/auth/login" className="text-primary hover:underline">Login</a>
            {' '}untuk menambahkan komentar
          </p>
        </div>
      )}

      {/* Comments List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3 py-4 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-gray-700" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-700 rounded w-1/4" />
                <div className="h-3 bg-gray-700 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length > 0 ? (
        <>
          <div className="divide-y divide-white/5">
            {comments.map((comment) => (
              <CommentItem key={comment._id} comment={comment} />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <button
              onClick={loadMore}
              className="w-full mt-4 py-2 text-center text-primary text-sm hover:underline"
            >
              Tampilkan lebih banyak komentar...
            </button>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          <FiMessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">Belum ada komentar. Jadilah yang pertama!</p>
        </div>
      )}
    </div>
  );
}
