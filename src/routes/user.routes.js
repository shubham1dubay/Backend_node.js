import { Router } from "express";
import {
  userRegister,
  loginUser,
  logoutUser,
} from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middlewares.js";
import { verifyJWT } from "../middlewares/auth.mddlewares.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  userRegister
);

router.route("/userlogin").post(loginUser);

router.route("/logout").post(verifyJWT, logoutUser);

export default router;
