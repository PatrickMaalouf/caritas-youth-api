const express = require('express');
const router = express.Router();
const postController = require('../controllers/post.controller');
const { protect, checkRole } = require('../middleware/auth.middleware');

// All post routes require a user to be logged in
router.use(protect);

/**
 * @route   GET /api/posts
 * @desc    Get all posts for the feed
 * @access  Protected
 */
router.get('/', postController.getAllPosts);

/**
 * @route   POST /api/posts
 * @desc    Create a new post (Announcement or Poll)
 * @access  Restricted to 'Bureau'
 */
router.post(
  '/', 
  checkRole(['Bureau']), // Only 'Bureau' can post
  postController.createPost
);

// We'll add routes for voting on polls (e.g., POST /api/posts/:id/vote) later

module.exports = router;