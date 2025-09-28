import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

export { userRegister, loginUser, logoutUser };
