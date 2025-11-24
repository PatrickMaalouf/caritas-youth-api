const { query } = require('../../db');
const { checkRole } = require('../middleware/auth.middleware');

/**
 * -----------------------------------------------------------------
 * Create a new Post (Announcement or Poll) - SIMPLIFIED
 * POST /api/posts
 * Restricted to: 'Bureau'
 * -----------------------------------------------------------------
 */
exports.createPost = async (req, res) => {
  const { userId } = req.user;
  const { title, content, type, options } = req.body;

  // 1. Validation
  if (!title || !type) {
    return res.status(400).json({ message: 'Title and type are required.' });
  }

  // We will handle polls in a later, more advanced step.
  // This temporary fix ensures "Announcement" posts work.
  if (type === 'Poll') {
    return res.status(400).json({ 
      message: 'Poll creation is more complex. Please create an "Announcement" for now.' 
    });
  }

  try {
    // 2. Insert the main "Announcement" post
    const postQuery = `
      INSERT INTO posts (title, content, author_id, type)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const postResult = await query(postQuery, [title, content, userId, type]);
    const newPost = postResult.rows[0];

    res.status(201).json(newPost);
    
  } catch (err) {
    console.error('Create Post Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * -----------------------------------------------------------------
 * Get all Posts
 * GET /api/posts
 * Access: Any logged-in user
 * -----------------------------------------------------------------
 */
exports.getAllPosts = async (req, res) => {
  try {
    const queryText = `
      SELECT 
        p.*, 
        u.first_name, 
        u.last_name
      FROM posts p
      JOIN users u ON p.author_id = u.id
      ORDER BY p.created_at DESC;
    `;
    const result = await query(queryText);
    
    res.status(200).json(result.rows);

  } catch (err) {
    console.error('Get All Posts Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};