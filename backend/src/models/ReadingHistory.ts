import mongoose, { Document, Schema } from 'mongoose';

export interface IReadingHistory extends Document {
  userId: mongoose.Types.ObjectId;
  contentType: 'novel' | 'komik';
  contentSlug: string;
  contentTitle: string;
  contentPoster: string;
  chapterSlug: string;
  chapterNumber: string;
  chapterTitle: string;
  readAt: Date;
  // Legacy field aliases for backward compatibility
  novelSlug?: string;
  novelTitle?: string;
  novelPoster?: string;
}

const readingHistorySchema = new Schema<IReadingHistory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    contentType: {
      type: String,
      enum: ['novel', 'komik'],
      default: 'novel',
    },
    contentSlug: {
      type: String,
      required: true,
    },
    contentTitle: {
      type: String,
      required: true,
    },
    contentPoster: {
      type: String,
      default: '',
    },
    chapterSlug: {
      type: String,
      required: true,
    },
    chapterNumber: {
      type: String,
      default: '',
    },
    chapterTitle: {
      type: String,
      default: '',
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual fields for backward compatibility with novel
readingHistorySchema.virtual('novelSlug').get(function() {
  return this.contentSlug;
});
readingHistorySchema.virtual('novelTitle').get(function() {
  return this.contentTitle;
});
readingHistorySchema.virtual('novelPoster').get(function() {
  return this.contentPoster;
});

// Index for efficient querying - last read chapter per content per user
readingHistorySchema.index({ userId: 1, readAt: -1 });
readingHistorySchema.index({ userId: 1, contentSlug: 1, contentType: 1 }, { unique: true });

export const ReadingHistory = mongoose.model<IReadingHistory>('ReadingHistory', readingHistorySchema);
export default ReadingHistory;

