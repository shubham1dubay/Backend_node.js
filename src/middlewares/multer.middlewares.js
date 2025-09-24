import multer from "multer";

const storage = multer.memoryStorage({
  destination: function (req, file, cb) {
    cb(null, "/punblic/temp");
  },
  filename: function (req, file, cd) {
    cd(null, file.originalname);
  },
});

export const upload = multer({
  storage,
});
