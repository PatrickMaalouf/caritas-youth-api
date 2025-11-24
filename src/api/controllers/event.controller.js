const { query } = require('../../db');

/**
 * -----------------------------------------------------------------
 * Get All Upcoming Events
 * GET /api/events
 * -----------------------------------------------------------------
 */
exports.getAllEvents = async (req, res) => {
  try {
    // We only want events that haven't ended yet
    // Order them by the start time, so the soonest is first
    const queryText = `
      SELECT 
        e.*,
        u.first_name,
        u.last_name
      FROM events e
      JOIN users u ON e.created_by = u.id
      WHERE e.end_time >= NOW()
      ORDER BY e.start_time ASC;
    `;

    const result = await query(queryText);
    res.status(200).json(result.rows);

  } catch (err) {
    console.error('Get All Events Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * -----------------------------------------------------------------
 * Create a new Event
 * POST /api/events
 * (This is the logic for the route we created earlier)
 * -----------------------------------------------------------------
 */
exports.createEvent = async (req, res) => {
  const { userId } = req.user; // from 'protect' middleware
  const { title, description, startTime, endTime, location } = req.body;

  // 1. Validation
  if (!title || !startTime || !endTime) {
    return res.status(400).json({ message: 'Title, start time, and end time are required.' });
  }

  try {
    // 2. Insert the event
    const insertQuery = `
      INSERT INTO events (title, description, start_time, end_time, location, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [title, description, startTime, endTime, location, userId];
    const result = await query(insertQuery, values);

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error('Create Event Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * -----------------------------------------------------------------
 * Submit or Update an RSVP for an event
 * POST /api/events/:eventId/rsvp
 * -----------------------------------------------------------------
 */
exports.handleRsvp = async (req, res) => {
  const { userId } = req.user; // from 'protect' middleware
  const { eventId } = req.params; // from the URL
  const { status } = req.body; // 'Going', 'Not Going', 'Maybe'

  // 1. Validation
  const validStatuses = ['Going', 'Not Going', 'Maybe'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ message: 'A valid status is required (Going, Not Going, Maybe).' });
  }

  try {
    // 2. "UPSERT" the RSVP
    // This command will INSERT a new row.
    // If a row with (user_id, event_id) already exists,
    // it will UPDATE the status instead.
    const queryText = `
      INSERT INTO event_rsvps (user_id, event_id, status)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, event_id)
      DO UPDATE SET status = $3, updated_at = NOW()
      RETURNING *;
    `;
    
    const result = await query(queryText, [userId, eventId, status]);
    
    res.status(201).json({
      message: `RSVP saved successfully! You are now set to '${status}'.`,
      rsvp: result.rows[0],
    });

  } catch (err) {
    console.error('Handle RSVP Error:', err);
    // Check if the event exists
    if (err.code === '23503') { // Foreign key violation
      return res.status(404).json({ message: 'Event not found.' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get ALL events (Past & Future) for Admin Reports
 * GET /api/events/history
 */
exports.getEventHistory = async (req, res) => {
  try {
    const queryText = `
      SELECT 
        e.*,
        u.first_name,
        u.last_name
      FROM events e
      JOIN users u ON e.created_by = u.id
      ORDER BY e.start_time DESC; -- Newest first
    `;
    const result = await query(queryText);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Get Event History Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};