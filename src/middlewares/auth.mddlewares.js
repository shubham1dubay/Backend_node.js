import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";

export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    const token = req.cookies?.accessToken || req.header;
    req.header("Authorixation")?.peplace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Unauthoried request");
    }
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshtoken"
    );
    if (!user) {
      throw new ApiError(401, "Ivalied token user");
    }
    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, error?.massage || "Invalied token user");
  }
});
