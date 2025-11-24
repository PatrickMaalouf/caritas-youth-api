const express = require('express');
const router = express.Router();

// Import the controller functions
const authController = require('../controllers/auth.controller');

// Define the routes
// POST /api/auth/register
router.post('/register', authController.register);

// POST /api/auth/login
router.post('/login', authController.login);

module.exports = router;