const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth.middleware');

// All chat routes require a user to be logged in
router.use(protect);

/**
 * @route   GET /api/chats
 * @desc    Get all chat rooms for the logged-in user
 */
router.get('/', chatController.getMyChatRooms);

/**
 * @route   POST /api/chats/private
 * @desc    Create or find a private 1-to-1 chat with another user
 */
router.post('/private', chatController.createOrFindPrivateChat);

/**
 * @route   GET /api/chats/:roomId/messages
 * @desc    Get all messages for a specific chat room
 */
router.get('/:roomId/messages', chatController.getMessagesForRoom);

module.exports = router;