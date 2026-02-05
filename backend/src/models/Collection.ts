import mongoose, { Document, Schema } from 'mongoose';

// Film item stored in collection
interface IFilmItem {
  filmId: string;
  title: string;
  slug: string;
  poster: string;
  year?: string;
  quality?: string;
  addedAt: Date;
}

export interface ICollection extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  films: IFilmItem[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const filmItemSchema = new Schema<IFilmItem>(
  {
    filmId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
    },
    poster: {
      type: String,
      default: '',
    },
    year: {
      type: String,
      default: '',
    },
    quality: {
      type: String,
      default: 'HD',
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const collectionSchema = new Schema<ICollection>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Collection name is required'],
      trim: true,
      maxlength: [100, 'Collection name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    films: {
      type: [filmItemSchema],
      default: [],
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for user's collections
collectionSchema.index({ userId: 1, name: 1 }, { unique: true });

export const Collection = mongoose.model<ICollection>('Collection', collectionSchema);
export default Collection;
