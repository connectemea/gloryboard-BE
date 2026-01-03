import { Admin } from "../models/admin.model.js";
import { User } from "../models/user.models.js";
import { authServices } from "../services/auth.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const registerAdmin = asyncHandler(async (req, res) => {
  const { name, email, phoneNumber, password } = req.body;

  if (!name || !email || !phoneNumber || !password) {
    throw new ApiError(400, "All fields are required!");
  }

  const admin = await authServices.registerAdmin({...req.body , user_type : "admin"});

  if (!admin) {
    throw new ApiError(500, "Failed to create admin");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, admin, "Admin created successfully"));
});

const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.query;
  const { name, phoneNumber, year_of_study, gender } = req.body;

  if (
    [name, phoneNumber, year_of_study].some(
      (field) => !field || field.trim() === ""
    )
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    id,
    { $set: { gender, name, phoneNumber, year_of_study } },
    { new: true }
  ).select("-password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User updated successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Number and password are required");
  }

  const user = await Admin.findOne({ email });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordCorrect = await user.isPasswordCorrect(password, user.password);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid password");
  }

  const { accessToken } = await authServices.generateAccessToken(user._id);

  const loggedInUser = await Admin.findById(user._id).select("-password");

  if (!loggedInUser) {
    throw new ApiError(404, "User not found");
  }

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken },
        "User logged in successfully"
      )
    );
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await Admin.findById(req.user._id).select("-password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User fetched successfully"));
});

export const authController = {
  registerAdmin,
  updateUser,
  loginUser,
  getCurrentUser,
};
