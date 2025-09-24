import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import e from "express";

const userRegister = asyncHandler(async (req, res) => {
  // get user detail from forntend
  const { username, email, fullname, password } = req.Body;
  // validation not empty
  if (
    [username, email, fullname, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "all fields are required to register a user");
  }
  // check if user already exists: username,email
  const exitingUser = User.findOne({ $or: [{ username }, { email }] });
  if (exitingUser) {
    throw new ApiError(409, "user already exists with this username or email");
  }
  // check for images check for avatar
  const avatarFile = req.files?.avatar[0]?.path;
  const coverImageFiles = req.files?.coverImage[0]?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "avatar is required for registering a user");
  }
  // upload them to cloudinary,avatar
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!avatar) {
    throw new ApiError(400, "could not upload avatar image");
  }
  if (!coverImage) {
    throw new ApiError(400, "could not upload coverImage image");
  }
  const user = await User.Create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    username: username.toLowerCase(),
    password,
  });

  // remove password and refresh token field from response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshtoken"
  );
  // check for user creation
  if (!createdUser) {
    throw new ApiError(
      500,
      "user not found after creation, something went wrong"
    );
  }
  // returun res
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "user craeted successfully"));
});

export { userRegister };
