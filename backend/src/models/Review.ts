import mongoose, { Document, Schema } from 'mongoose';

export interface IReview extends Document {
  userId: mongoose.Types.ObjectId;
  contentId: string;
  contentType: 'film';
  rating: number; // 1-5 stars
  content: string;
  likes: number;
  likedBy: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    contentId: {
      type: String,
      required: true,
      index: true,
    },
    contentType: {
      type: String,
      enum: ['film'],
      required: true,
      default: 'film',
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    content: {
      type: String,
      required: [true, 'Review content is required'],
      maxlength: [2000, 'Review cannot exceed 2000 characters'],
    },
    likes: {
      type: Number,
      default: 0,
    },
    likedBy: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate reviews (one review per user per content)
reviewSchema.index({ userId: 1, contentId: 1, contentType: 1 }, { unique: true });
// Index for efficient querying
reviewSchema.index({ contentId: 1, contentType: 1, createdAt: -1 });

export const Review = mongoose.model<IReview>('Review', reviewSchema);
export default Review;
