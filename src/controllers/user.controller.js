import { User } from "../models/user.models.js";
import { EventRegistration } from "../models/eventRegistration.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { userService } from "../services/user.service.js";

// Helper function to validate maximum age (25 years as of July 1, 2025)
const validateMaxAge = (dob) => {
  const birthDate = new Date(dob);
  const referenceDate = new Date("2025-07-01"); 
  
  if (isNaN(birthDate.getTime())) {
    throw new ApiError(400, "Invalid date of birth format");
  }
  
  if (birthDate > new Date()) {
    throw new ApiError(400, "Date of birth cannot be in the future");
  }
  
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthDate.getMonth();
  const dayDiff = referenceDate.getDate() - birthDate.getDate();
  
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }
  
  if (age > 25) {
    throw new ApiError(400, `User age must be 25 years or less as of July 1, 2025. Current age: ${age} years`);
  }
  
  return true;
};

const fetchUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search = "", gender } = req.query;
  let users;
  const searchQuery = search
    ? {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { phoneNumber: { $regex: search, $options: "i" } },
        ],
      }
    : {};

  if (gender) {
    searchQuery.gender = gender;
  }

  const totalElements = await User.countDocuments(searchQuery);

  if (req.user.user_type === "admin") {
    users = await User.find(searchQuery)
      .select("-password -__v -created_at -updated_at")
      .populate("collegeId", "name")
      .skip((page - 1) * limit)
      .limit(Number(limit));
  } else if (req.user.user_type === "organization") {
    users = await User.find({ ...searchQuery, collegeId: req.user._id })
      .select("-password -__v -created_at -updated_at")
      .skip((page - 1) * limit)
      .limit(Number(limit));
  }

  if (!users) {
    throw new ApiError(404, "No users found");
  }

  const totalPages = Math.ceil(totalElements / limit);

  return res
    .status(200)
    .json(new ApiResponse(200, { users, totalElements, limit : Number(limit) , totalPages }, "Users fetched successfully"));
});

const registerUser = asyncHandler(async (req, res) => {
  const {
    name,
    gender,
    phoneNumber,
    course,
    semester,
    year_of_study,
    capId,
    dob,
  } = req.body;

  if (
    !name ||
    !gender ||
    !phoneNumber ||
    !course ||
    !semester ||
    !year_of_study ||
    !capId ||
    !dob
  ) {
    throw new ApiError(400, "All fields are required");
  }

  validateMaxAge(dob);

  if (!req.file) throw new ApiError(400, "Picture is required");

  req.body.collegeId = req.user._id;
  req.body.college = req.user.name;
  req.body.image = req.file.path;

  const user = await userService.registerUser(req);

  if (!user) {
    throw new ApiError(500, "Failed to create user");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, user, "User created successfully"));
});

const updateUser = asyncHandler(async (req, res) => {
  const {
    name,
    gender,
    phoneNumber,
    course,
    semester,
    year_of_study,
    capId,
    dob,
  } = req.body;

  if (
    !name ||
    !gender ||
    !phoneNumber ||
    !course ||
    !semester ||
    !year_of_study ||
    !capId ||
    !dob
  ) {
    throw new ApiError(400, "All fields are required");
  }

  validateMaxAge(dob);

  const user = await userService.updateUser(req);

  if (!user) {
    throw new ApiError(500, "Failed to update user");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User updated successfully"));
});

const deleteUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const eventRegistration = await EventRegistration.findOne({
    "participants.user": id,
  });

  if (eventRegistration) {
    throw new ApiError(
      409,
      "User is registered in an event and cannot be deleted"
    );
  }

  const user = await User.findByIdAndDelete(id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, "User deleted successfully"));
});

export const userController = {
  registerUser,
  fetchUsers,
  deleteUserById,
  updateUser,
};
