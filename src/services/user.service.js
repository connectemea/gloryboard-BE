import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { storageService } from "./storage.service.js";

const registerUser = async (req) => {
  const data = req.body;
  const fileName = req.file.originalname;
  const imageLocalPath = req.file.path;

  try {
    const existingUser = await User.findOne({
      $or: [{ phoneNumber: data.phoneNumber }],
      $or: [{ capId: data.capId }],
    });

    if (existingUser) {
      if (existingUser.phoneNumber === data.phoneNumber) {
        throw new ApiError(409, "User with this phone number already exists");
      }
      if (existingUser.capId === data.capId) {
        throw new ApiError(409, "User with this capId already exists");
      }
    }
    const user = await User.create({
      ...data,
    });
    var image = await storageService.uploadToSpace(fileName , imageLocalPath, user._id);
    if (!image) {
      throw new ApiError(500, "Failed to upload image");
    }
    user.image = image;
    await user.save();

    const createdUserWithImage = await User.findById(user._id).select(
      "-password"
    );

    return createdUserWithImage;
  } catch (error) {
    console.log(error, "Error creating user");
    if (image) {
      await storageService.deleteFromSpace(image);
    }

    throw error;
  }
};
  
const updateUser = async (req) => {
  const data = req.body;
  const userId = req.params.id;
  let image;

  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (req.file) {
      const fileName = req.file.originalname;
      const imageLocalPath = req.file.path;
      image = await storageService.uploadToSpace(fileName, imageLocalPath, user._id);
      if (!image) {
        throw new ApiError(500, "Failed to upload image");
      }
      user.image = image;
    }

    Object.assign(user, data);
    await user.save();

    const updatedUserWithImage = await User.findById(user._id).select("-password");

    return updatedUserWithImage;
  } catch (error) {
    console.log(error, "Error updating user");
    if (image) {
      await storageService.deleteFromSpace(image);
    }

    throw error;
  }
};

export const userService = {
  registerUser,
  updateUser,
};
