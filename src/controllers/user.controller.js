import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../services/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Something went wrong while generating tokens");
  }
};

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

const loginUser = asyncHandler(async (req, res) => {
  console.log("req.body", req.body);
  const { email, password } = req.body;
  console.log("email, password", email, password);
  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, "User doesn't exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(400, "Password is incorrect");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        200,
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: undefined },
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
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});
export { registerUser, loginUser, logoutUser };
