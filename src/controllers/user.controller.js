import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../services/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, password, username } = req.body;
  console.log(fullName, email, password, username);

  if (!fullName || !email || !password || !username) {
    throw new ApiError(400, "All fields are required");
  }

  const duplicateUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (duplicateUser) {
    throw new ApiError(409, "User already exists");
  }

  const avatarLocalFile = req.files?.avatar[0].path;

  let coverImageLocalFile;
  if (
    req.files &&
    typeof req.files.coverImage === Array &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalFile = req.files.coverImage[0].path;
  }

  if (!avatarLocalFile) {
    throw new ApiError(400, "Avatar is required");
  }

  const cloudAvatar = await uploadOnCloudinary(avatarLocalFile);
  const cloudCoverImage = await uploadOnCloudinary(coverImageLocalFile);

  if (!cloudAvatar) {
    throw new ApiError(400, "Avatar is required cloudinary error");
  }

  const user = await User.create({
    fullName,
    email,
    password,
    username: username.toLowerCase(),
    avatar: cloudAvatar.url,
    coverImage: cloudCoverImage?.url || "",
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while creating user");
  }

  if (createdUser) {
    return res
      .status(201)
      .json(new ApiResponse(createdUser, 201, "User created"));
  }
});
export default registerUser;
