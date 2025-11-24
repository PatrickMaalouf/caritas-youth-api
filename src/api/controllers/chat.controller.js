const { query } = require('../../db');

/**
 * -----------------------------------------------------------------
 * Get All Chat Rooms for the Logged-in User
 * (Includes the last message preview)
 * GET /api/chats
 * -----------------------------------------------------------------
 */
exports.getMyChatRooms = async (req, res) => {
  const { userId } = req.user;

  try {
    // We select the room details, plus we run a subquery to find
    // the content and time of the very last message in that room.
    const queryText = `
      SELECT 
        cr.id, 
        cr.name, 
        cr.type,
        (
          SELECT content 
          FROM messages m 
          WHERE m.room_id = cr.id 
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT created_at 
          FROM messages m 
          WHERE m.room_id = cr.id 
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) as last_message_time
      FROM chat_rooms cr
      JOIN chat_members cm ON cr.id = cm.room_id
      WHERE cm.user_id = $1
      ORDER BY last_message_time DESC NULLS LAST; -- Show rooms with new messages at the top
    `;
    
    const result = await query(queryText, [userId]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Get My Chat Rooms Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * -----------------------------------------------------------------
 * Get Message History for a Specific Chat Room
 * GET /api/chats/:roomId/messages
 * -----------------------------------------------------------------
 */
exports.getMessagesForRoom = async (req, res) => {
  const { userId } = req.user;
  const { roomId } = req.params;

  try {
    // 1. First, check if the user is actually a member of this room
    const memberCheck = await query(
      'SELECT * FROM chat_members WHERE user_id = $1 AND room_id = $2',
      [userId, roomId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Forbidden: You are not a member of this room.' });
    }

    // 2. If they are a member, fetch all messages for that room
    const messagesQuery = `
      SELECT m.*, u.first_name, u.last_name 
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.room_id = $1
      ORDER BY m.created_at ASC; -- Show oldest first
    `;
    const messagesResult = await query(messagesQuery, [roomId]);
    res.status(200).json(messagesResult.rows);

  } catch (err) {
    console.error('Get Messages Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * -----------------------------------------------------------------
 * Create or Find a Private 1-to-1 Chat
 * POST /api/chats/private
 * -----------------------------------------------------------------
 */
exports.createOrFindPrivateChat = async (req, res) => {
  const { userId: myId } = req.user;
  const { otherUserId } = req.body; // The ID of the user you want to chat with

  if (!otherUserId) {
    return res.status(400).json({ message: 'otherUserId is required.' });
  }

  if (myId == otherUserId) {
    return res.status(400).json({ message: 'You cannot create a chat with yourself.' });
  }

  try {
    // 1. Find if a private room *already exists* between these two users.
    // This is a complex query that finds rooms where BOTH users are members.
    const findRoomQuery = `
      SELECT cm1.room_id
      FROM chat_members cm1
      JOIN chat_members cm2 ON cm1.room_id = cm2.room_id
      WHERE cm1.user_id = $1 AND cm2.user_id = $2 AND (
        SELECT type FROM chat_rooms WHERE id = cm1.room_id
      ) = 'private';
    `;
    const roomResult = await query(findRoomQuery, [myId, otherUserId]);

    if (roomResult.rows.length > 0) {
      // 2. A room already exists, just return it.
      const existingRoom = await query('SELECT * FROM chat_rooms WHERE id = $1', [roomResult.rows[0].room_id]);
      return res.status(200).json(existingRoom.rows[0]);
    }

    // 3. No room exists. We need to create one.
    // We'll use a transaction to make sure all steps complete.
    await query('BEGIN'); // Start transaction

    // 3a. Create the new 'private' room
    const newRoomResult = await query(
      "INSERT INTO chat_rooms (type) VALUES ('private') RETURNING *"
    );
    const newRoom = newRoomResult.rows[0];

    // 3b. Add the first user (me) to the room
    await query(
      'INSERT INTO chat_members (user_id, room_id) VALUES ($1, $2)',
      [myId, newRoom.id]
    );
    
    // 3c. Add the second user to the room
    await query(
      'INSERT INTO chat_members (user_id, room_id) VALUES ($1, $2)',
      [otherUserId, newRoom.id]
    );

    await query('COMMIT'); // Commit transaction
    res.status(201).json(newRoom);

  } catch (err) {
    await query('ROLLBACK'); // Rollback on error
    console.error('Create Private Chat Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};