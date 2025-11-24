const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect, checkRole } = require('../middleware/auth.middleware');

// All routes in this file are protected and require a valid token
router.use(protect);

// GET /api/users/me
// Gets the logged-in user's profile
router.get('/me', userController.getMyProfile);

// PUT /api/users/me
// Updates the logged-in user's profile
router.put('/me', userController.updateMyProfile);

// ADD THIS ROUTE vvv
// PUT /api/users/me/push-token
router.put('/me/push-token', userController.registerPushToken);

// GET /api/users/pending
router.get(
  '/pending', 
  checkRole(['Bureau']), // Only Bureau can see pending list
  userController.getPendingUsers
);

// PUT /api/users/:id/status
router.put(
  '/:id/status', 
  checkRole(['Bureau']), // Only Bureau can approve/reject
  userController.updateUserStatus
);

// GET /api/users/all
router.get(
  '/all',
  checkRole(['Bureau']), // Only Bureau can see the full list
  userController.getAllUsers
);

module.exports = router;