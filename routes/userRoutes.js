// // import express from 'express';
// // import { authUser, registerUser } from '../controllers/userController.js';
// // import { admin, protect } from '../middleware/authMiddleware.js';
// // const router = express.Router();

// // router.post('/login', authUser);
// // router.route('/').post(protect, admin, registerUser); // Only admin can register users

// // export default router;

// import express from 'express';
// import { authUser, registerUser, seedAdmin } from '../controllers/userController.js';
// import { admin, protect } from '../middleware/authMiddleware.js';

// const router = express.Router();

// // PUBLIC
// router.post('/login', authUser);

// // ONE TIME ONLY (NO TOKEN REQUIRED)
// router.post('/seed-admin', seedAdmin);

// // ADMIN ONLY
// router.post('/', protect, admin, registerUser);

// export default router;


import express from 'express';
import {
  authUser,
  deleteUser,
  getUserById,
  getUsers,
  registerUser,
  seedAdmin,
  updateUser,
  updateUserProfile
} from '../controllers/userController.js';
import { admin, protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// PUBLIC
router.post('/login', authUser);

// ONE TIME ONLY
router.post('/seed-admin', seedAdmin);

// ADMIN
router.route('/')
  .get(protect, admin, getUsers)
  .post(protect, admin, registerUser);

// PROFILE
router.route('/profile')
  .put(protect, updateUserProfile);

// SINGLE USER
router.route('/:id')
  .get(protect, admin, getUserById)
  .put(protect, admin, updateUser)
  .delete(protect, admin, deleteUser);

export default router;
