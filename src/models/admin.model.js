import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { USER_ZONE_KEYS } from "../constants.js";


const adminSchema = new mongoose.Schema({
  user_type : { type: String, required: true, enum : ["admin", "organization"]},
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true},
  phoneNumber : { type: Number, required: true, unique: true },
  zone: { type: String, enum: USER_ZONE_KEYS, index: true },
} , {
    timestamps: true,
});



adminSchema.pre("save", async function (next) {
    if (this.isModified("password") && this.password) {
        this.password = await bcrypt.hash(this.password, 8);
    }
    next();
    }
);

adminSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
}

adminSchema.methods.generateJWT = function () {
    return jwt.sign(
        {
            _id: this._id,
            name: this.name,
            phone: this.phone,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRATION,
        }
    );
};

adminSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            phone: this.phone,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRATION,
        }
    );
};

export const Admin = mongoose.model("Admin", adminSchema);