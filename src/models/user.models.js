import mongoose, { Schema } from "mongoose";
import { Counter } from "./counter.model.js";

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true },
  name: { type: String, required: true },
  gender: { type: String, required: true, enum: ["male", "female"] },
  phoneNumber: { type: String, required: true, unique: true },
  course : { type: String, required: true },
  college: { type: String, required: true },
  semester : { type: Number, required: true },
  year_of_study : {type : Number , required : true},
  capId: { type: String, required: true },
  image: { type: String, required: true },
  dob : { type: Date, required: true },
  total_score: { type: Number, default: 0 }
} , {
    timestamps: true,
});

userSchema.pre('save', async function(next) {
  if (this.isNew) {
    const counter = await Counter.findOneAndUpdate(
      { _id: 'userId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.userId = `KLM${String(counter.seq).padStart(4, '0')}`;
  }
  next();
});

export const User = mongoose.model("User", userSchema);
