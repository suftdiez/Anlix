import mongoose, { Document, Schema } from 'mongoose';

export interface IReadingHistory extends Document {
  userId: mongoose.Types.ObjectId;
  novelSlug: string;
  novelTitle: string;
  novelPoster: string;
  chapterSlug: string;
  chapterNumber: string;
  chapterTitle: string;
  readAt: Date;
}

const readingHistorySchema = new Schema<IReadingHistory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    novelSlug: {
      type: String,
      required: true,
    },
    novelTitle: {
      type: String,
      required: true,
    },
    novelPoster: {
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

// Index for efficient querying - last read chapter per novel per user
readingHistorySchema.index({ userId: 1, readAt: -1 });
readingHistorySchema.index({ userId: 1, novelSlug: 1 }, { unique: true });

export const ReadingHistory = mongoose.model<IReadingHistory>('ReadingHistory', readingHistorySchema);
export default ReadingHistory;
