// const asyncHandler =()=>{}
// const asyncHandler = (fn) => () => {}
// const asyncHandler = (fn) => async() => {}

const asyncHandler = (requestHanler) => {
  return (req, res, next) => {
    Promise.resolve(requestHanler(req, res, next)).catch((err) => next(err));
  };
};

export { asyncHandler };

// const asyncHandler = (fu) => async (req, res, next) => {
//   try {
//   } catch (error) {
//     res.status(err.code || 500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };
