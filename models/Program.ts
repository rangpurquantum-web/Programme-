import mongoose, { Schema } from 'mongoose';

const ItemSchema = new Schema({ title: String, speaker: String, note: String }, { _id: false });

const ProgramSchema = new Schema(
  {
    title: { type: String, required: true },
    items: { type: [ItemSchema], default: [] },
    currentIndex: { type: Number, default: 0 },
    isLive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.Program || mongoose.model('Program', ProgramSchema);
