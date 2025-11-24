const { query } = require('../../db');

/**
 * Get the profile of the currently logged-in user
 * GET /api/users/me
 */
exports.getMyProfile = async (req, res) => {
  try {
    // req.user.userId is available from our 'protect' middleware
    const userId = req.user.userId;

    // Query for the user, joining with their role name
    // CRITICAL: We explicitly list the columns to avoid sending the password_hash
    const profileQuery = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, 
        u.profile_photo_url, u.status, u.created_at,
        u.phone_number, u.date_of_birth, u.emergency_contact, -- Added these
        r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `;
    
    const userResult = await query(profileQuery, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json(userResult.rows[0]);

  } catch (err) {
    console.error('Get Profile Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Update the profile of the currently logged-in user
 * PUT /api/users/me
 */
exports.updateMyProfile = async (req, res) => {
  try {
    const { userId } = req.user;
    const body = req.body;

    // 1. Get the current user data
    const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const currentUser = userResult.rows[0];

    // 2. Create the new profile data (CORRECTED LOGIC)
    // We check if the property *exists* in the request body.
    // This allows setting fields to "" or null.
    const newFirstName = body.hasOwnProperty('firstName') ? body.firstName : currentUser.first_name;
    const newLastName = body.hasOwnProperty('lastName') ? body.lastName : currentUser.last_name;
    const newProfilePhoto = body.hasOwnProperty('profilePhotoUrl') ? body.profilePhotoUrl : currentUser.profile_photo_url;

    // 3. Update the database
    const updateQuery = `
      UPDATE users
      SET 
        first_name = $1, 
        last_name = $2, 
        profile_photo_url = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING id, first_name, last_name, email, profile_photo_url; 
    `;
    
    const updatedResult = await query(updateQuery, [
      newFirstName, 
      newLastName, 
      newProfilePhoto, 
      userId
    ]);

    res.status(200).json({
      message: 'Profile updated successfully!',
      user: updatedResult.rows[0],
    });

  } catch (err) {
    console.error('Update Profile Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Register or update a user's push token
 * PUT /api/users/me/push-token
 */
exports.registerPushToken = async (req, res) => {
  const { userId } = req.user;
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: 'Push token is required.' });
  }

  try {
    const updateQuery = `
      UPDATE users
      SET push_token = $1
      WHERE id = $2
      RETURNING id, push_token;
    `;
    const result = await query(updateQuery, [token, userId]);
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Register Push Token Error:', err);
    // Handle unique constraint violation (if another user has the same token)
    if (err.code === '23505') { 
      // This is OK, it just means the token was already registered.
      // You could also log this as a potential issue.
      return res.status(200).json({ message: 'Token already registered.' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get all users with 'Pending' status
 * GET /api/users/pending
 */
exports.getPendingUsers = async (req, res) => {
  try {
    const queryText = `
      SELECT id, first_name, last_name, email, created_at 
      FROM users 
      WHERE status = 'Pending'
      ORDER BY created_at DESC;
    `;
    const result = await query(queryText);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Get Pending Users Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Approve or Reject a user
 * PUT /api/users/:id/status
 */
exports.updateUserStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'Approved' or 'Rejected'

  const validStatuses = ['Approved', 'Rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }

  try {
    const result = await query(
      'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, email, status',
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({ 
      message: `User ${status} successfully.`, 
      user: result.rows[0] 
    });

  } catch (err) {
    console.error('Update User Status Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get ALL users (for admin reports)
 * GET /api/users/all
 */
exports.getAllUsers = async (req, res) => {
  try {
    // Fetch ID, Name, Email, Role, and Status
    const queryText = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.status, u.created_at,
        u.phone_number, u.date_of_birth, u.emergency_contact, -- Added these
        r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.last_name ASC;
    `;
    const result = await query(queryText);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Get All Users Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};