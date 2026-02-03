import mongoose, { Document, Schema } from 'mongoose';

export interface IBookmark extends Document {
  userId: mongoose.Types.ObjectId;
  contentId: string;
  contentType: 'anime' | 'donghua' | 'novel' | 'komik';
  title: string;
  poster: string;
  slug: string;
  addedAt: Date;
}

const bookmarkSchema = new Schema<IBookmark>(
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
      enum: ['anime', 'donghua', 'novel', 'komik'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    poster: {
      type: String,
      default: '',
    },
    slug: {
      type: String,
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate bookmarks
bookmarkSchema.index({ userId: 1, contentId: 1, contentType: 1 }, { unique: true });

export const Bookmark = mongoose.model<IBookmark>('Bookmark', bookmarkSchema);
export default Bookmark;
