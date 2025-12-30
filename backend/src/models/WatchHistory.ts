import mongoose, { Document, Schema } from 'mongoose';

export interface IWatchHistory extends Document {
  userId: mongoose.Types.ObjectId;
  contentId: string;
  contentType: 'anime' | 'donghua';
  episodeId: string;
  episodeNumber: number;
  title: string;
  episodeTitle: string;
  poster: string;
  slug: string;
  progress: number; // percentage 0-100
  watchedAt: Date;
}

const watchHistorySchema = new Schema<IWatchHistory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    contentId: {
      type: String,
      required: true,
    },
    contentType: {
      type: String,
      enum: ['anime', 'donghua'],
      required: true,
    },
    episodeId: {
      type: String,
      required: true,
    },
    episodeNumber: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    episodeTitle: {
      type: String,
      default: '',
    },
    poster: {
      type: String,
      default: '',
    },
    slug: {
      type: String,
      required: true,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    watchedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
watchHistorySchema.index({ userId: 1, watchedAt: -1 });
watchHistorySchema.index({ userId: 1, contentId: 1, episodeId: 1 }, { unique: true });

export const WatchHistory = mongoose.model<IWatchHistory>('WatchHistory', watchHistorySchema);
export default WatchHistory;
