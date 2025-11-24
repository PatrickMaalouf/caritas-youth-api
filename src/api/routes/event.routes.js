const express = require('express');
const router = express.Router();
const eventController = require('../controllers/event.controller'); // <-- Import the controller
const { protect, checkRole } = require('../middleware/auth.middleware');

// All event routes require a user to be logged in
router.use(protect);

/*
 * @route   GET /api/events
 * @desc    Get all upcoming events
 * @access  Protected (All logged-in users)
 */
router.get('/', eventController.getAllEvents); // <-- Use the new controller

/*
 * @route   POST /api/events
 * @desc    Create a new event
 * @access  Restricted (Only 'Bureau')
 */
router.post(
  '/', 
  checkRole(['Bureau']), // 1. Check if 'Bureau'
  eventController.createEvent // <-- Use the new controller
);

/*
 * @route   POST /api/events/:eventId/rsvp  <-- THIS IS THE NEW ROUTE
 * @desc    Submit or update an RSVP for a specific event
 * @access  Protected
 */
router.post('/:eventId/rsvp', eventController.handleRsvp);

/*
 * @route   PUT /api/events/:id
 * @desc    Edit an event (Placeholder for now)
 */
router.put(
  '/:id', 
  checkRole(['Bureau', 'Leader']), 
  (req, res) => {
    res.json({ 
      message: `Edit event feature for ${req.params.id} coming soon.` 
    });
  }
);

// GET /api/events/history
router.get(
  '/history',
  checkRole(['Bureau']), 
  eventController.getEventHistory
);

module.exports = router;