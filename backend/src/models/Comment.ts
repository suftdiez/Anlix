import mongoose, { Document, Schema } from 'mongoose';

export interface IComment extends Document {
  userId: mongoose.Types.ObjectId;
  contentId: string;
  contentType: 'anime' | 'donghua';
  episodeId?: string;
  content: string;
  likes: number;
  likedBy: mongoose.Types.ObjectId[];
  parentId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
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
      enum: ['anime', 'donghua'],
      required: true,
    },
    episodeId: {
      type: String,
      default: null,
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
    likes: {
      type: Number,
      default: 0,
    },
    likedBy: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
commentSchema.index({ contentId: 1, contentType: 1, createdAt: -1 });
commentSchema.index({ parentId: 1 });

export const Comment = mongoose.model<IComment>('Comment', commentSchema);
export default Comment;
