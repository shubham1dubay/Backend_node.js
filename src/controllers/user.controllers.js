import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { use } from "react";
import { Subscription } from "../models/subscriptions.models.js";
import mongoose, { mongo } from "mongoose";

const generateAccessAndReferceToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accestoken = user.generateAccessToken();
    const accessRefersh = user.generateRefreshToken();
    user.referecetoken = accestoken;
    await user.save({ validateBeforeSave: false });
    return { accessRefersh, accestoken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something want to wrong while generating refesh and sucess token"
    );
  }
};

const userRegister = asyncHandler(async (req, res) => {
  // get user detail from forntend
  const { username, email, fullname, password } = req.body;
  // validation not empty
  if (
    [username, email, fullname, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "all fields are required to register a user");
  }
  // check if user already exists: username,email
  const exitingUser = await User.findOne({ $or: [{ username }, { email }] });
  if (exitingUser) {
    throw new ApiError(409, "user already exists with this username or email");
  }
  console.log(req.files);
  // check for images check for avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;
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
  const user = await User.create({
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

const loginUser = asyncHandler(async (req, res) => {
  // req body
  const { email, username, password } = req.body;
  // username or email
  if (!username && !email) {
    throw new ApiError(400, "Username or email is required");
  }
  // find the user
  const user = await User.findOne({
    $or: [{ email }, { username }],
  });
  if (!user) {
    throw new ApiError(400, "User do't not exites");
  }
  // password check
  const isPasswordCorrect = await user.isPasswordCorrect(password);

  if (!isPasswordCorrect) {
    throw new ApiError(401, "Password is not correct");
  }
  // access token refernce token
  const { accestoken, refreshToken } = await generateAccessAndReferceToken(
    user._id
  );
  // send cookies
  const options = {
    // ye pass karte hai server pr
    httpOnly: true,
    secure: true,
  }; // jitne chahe utna  cookies  pass kr shakte hai .cookies lga ke
  return res
    .status(200)
    .cookie("accessToken", accestoken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { accestoken, refreshToken },
        "User logged in successfully"
      )
    );
});
const logoutUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        referecetoken: undefined,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookies("accestoken", options)
    .clearCookies("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

const refereceAccesstoken = asyncHandler(async (req, res) => {
  try {
    const incomingRefereceToken =
      req.cookies.referecetoken || req.body.refreshToken;

    if (!incomingRefereceToken) {
      throw new ApiError(401, "Unauthorized request");
    }
    const decodedToken = jwt.verify(
      incomingRefereceToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id);
    if (!use) {
      throw new ApiError(401, "Invalid refesh token");
    }
    if (incomingRefereceToken !== user?.refreshToken) {
      throw new ApiError(401, "Referece token is expire or used");
    }
    const options = {
      httpOnly: true,
      secure: true,
    };
    const { accessRefersh, newReferecetoken } =
      await generateAccessAndReferceToken(user._id);
    return res
      .status(200)
      .cookie("accessRefersh", accessRefersh.options)
      .cookie("referecetoken", newReferecetoken.options)
      .json(
        200,
        { accestoken, referecetoken: newReferecetoken },
        "Access token Referce"
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalied refersh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invaliad password");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json(new ApiResponse(200, {}, "Password change"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json(200, res.user, "current user fatch successfully");
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;
  if (!fullname || !email) {
    throw new ApiError(400, "All field is required");
  }
  const user = User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname,
        email,
      },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = (req.file = path);
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading on avatar");
  }
  const updateAvatar = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverLocalPath = (req.file = path);
  if (!coverLocalPath) {
    throw new ApiError(400, "Avatar Image file is missing");
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading on avatar");
  }
  const updateAvatar = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }
  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscription",
        localField: "_id",
        foreignField: "channel",
        as: "Subscription",
      },
    },
    {
      $lookup: {
        from: "subscription",
        localField: "_id",
        foreignField: "subscriber",
        as: "SubscriptionTo",
      },
    },
    {
      $addFields: {
        subscriptionCount: { $size: "$Subscription" },
        channelsSubscribedToCount: { $size: "$SubscriptionTo" },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subsriber"] },
            then: true,
            else: false,
          },
        },
      },
      $project: {
        fullname: 1,
        username: 1,
        subscriptionCount: 1,
        channelsSubscribedToCount: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
        isSubscribed: 1,
      },
    },
  ]);
  if (!channel?.length) {
    throw new ApiError(400, "channel does not exits");
  }
  return res
    .status(200)
    .json(new ApiError(200, channel[0], "User channel fetch successfully"));
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        form: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullname: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "watch hostory fetch successfully"
      )
    );
});

export {
  userRegister,
  loginUser,
  logoutUser,
  refereceAccesstoken,
  changeCurrentPassword,
  getCurrentUser,
  updateUserAvatar,
  updateUserCoverImage,
  updateAccountDetails,
  getUserChannelProfile,
  getWatchHistory,
};
