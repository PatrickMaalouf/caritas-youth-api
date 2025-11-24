const { query } = require('../../db'); // Our centralized query function
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * Register a new user
 * POST /api/auth/register
 */
exports.register = async (req, res) => {
  const { firstName, lastName, email, password, phoneNumber, dob, emergencyContact } = req.body;

  // 1. Simple Validation
  if (!email || !password || !firstName || !lastName || !phoneNumber || !dob || !emergencyContact) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    // 2. Check if user already exists
    const userCheck = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ message: 'Email is already in use.' });
    }

    // 3. Get the default 'Member' role ID
    const roleResult = await query("SELECT id FROM roles WHERE name = 'Member'");
    if (roleResult.rows.length === 0) {
      // This is a server setup error, the seed script wasn't run
      return res.status(500).json({ message: 'Default user role not found.' });
    }
    const memberRoleId = roleResult.rows[0].id;

    // 4. Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 5. Insert the new user with 'Pending' status (as per our schema)
    const insertQuery = `
      INSERT INTO users (first_name, last_name, email, password_hash, role_id, status, phone_number, date_of_birth, emergency_contact)
      VALUES ($1, $2, $3, $4, $5, 'Pending', $6, $7, $8)
      RETURNING id, email, first_name, status;
    `;
    
    const values = [
      firstName, 
      lastName, 
      email, 
      passwordHash, 
      memberRoleId, 
      phoneNumber, 
      dob, 
      emergencyContact
    ];
    
    const newUser = await query(insertQuery, values);

    // 6. Send success response
    res.status(201).json({
      message: 'Registration successful! Your account is pending admin approval.',
      user: newUser.rows[0],
    });

  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Login a user
 * POST /api/auth/login
 */
exports.login = async (req, res) => {
  const { email, password } = req.body;

  // 1. Simple Validation
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // 2. Find the user and get their role name
    // We JOIN with the roles table to get the role name for the JWT
    const userQuery = `
      SELECT u.*, r.name as role_name 
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.email = $1
    `;
    const userResult = await query(userQuery, [email]);

    // 3. Check if user exists
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const user = userResult.rows[0];

    // 4. Check if password is correct
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 5. CRITICAL: Check if user is approved (as per your plan)
    if (user.status !== 'Approved') {
      if (user.status === 'Pending') {
        return res.status(403).json({ message: 'Your account is pending admin approval.' });
      }
      if (user.status === 'Rejected') {
        return res.status(403).json({ message: 'Your account has been rejected.' });
      }
      return res.status(403).json({ message: 'Account not active.' });
    }

    // 6. User is valid, approved, and password is correct.
    // Create JWT payload.
    const payload = {
      userId: user.id,
      firstName: user.first_name,
      role: user.role_name, // e.g., 'Member', 'Leader', 'Bureau'
    };

    // 7. Sign the token
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET, // Your secret key from .env
      { expiresIn: '24h' }  // Token expires in 24 hours
    );

    // 8. Send the token and user info to the client
    res.status(200).json({
      message: 'Login successful!',
      token: token,
      user: payload,
    });

  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};