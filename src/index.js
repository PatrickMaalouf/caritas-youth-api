// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { query } = require('./db');
const jwt = require('jsonwebtoken');

// --- NEW IMPORTS ---
const http = require('http'); // 1. Import Node's built-in HTTP module
const { Server } = require('socket.io'); // 2. Import Socket.IO

// Import API routes
const authRoutes = require('./api/routes/auth.routes');
const eventRoutes = require('./api/routes/event.routes');
const userRoutes = require('./api/routes/user.routes');
const postRoutes = require('./api/routes/post.routes');
const chatRoutes = require('./api/routes/chat.routes');

// Initialize the Express app
const app = express();

// --- NEW SERVER SETUP ---
// 3. Create the HTTP server using your Express app
const server = http.createServer(app);

// 4. Initialize Socket.IO and attach it to the HTTP server
const io = new Server(server, {
  cors: {
    origin: '*', // For development, allow all connections
    methods: ['GET', 'POST'],
  },
});

// --- Global Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger Middleware (you can keep this)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/chats', chatRoutes);

// --- Test Route ---
app.get('/', (req, res) => {
  res.json({ message: 'Caritas Youth API is running!' });
});

// --- NEW SOCKET.IO AUTHENTICATION MIDDLEWARE ---
// This function runs BEFORE 'connection'
// It verifies the user's JWT
io.use((socket, next) => {
  // The client will send the token in socket.auth
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication error: No token provided.'));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decodedUser) => {
    if (err) {
      return next(new Error('Authentication error: Invalid token.'));
    }
    
    // Attach the user's data to the socket object
    socket.user = decodedUser; // { userId, firstName, role }
    next();
  });
});


// --- UPDATED SOCKET.IO CONNECTION HANDLER ---
io.on('connection', (socket) => {
  // Thanks to our middleware, we know who the user is
  console.log(`🔌 User connected: ${socket.user.firstName} (ID: ${socket.user.userId})`);

  // --- 1. JOIN ROOM ---
  // Client sends this when they open a chat screen
  socket.on('joinRoom', async (roomId) => {
    try {
      // Security Check: Is this user *allowed* in this room?
      const { userId } = socket.user;
      const memberCheck = await query(
        'SELECT * FROM chat_members WHERE user_id = $1 AND room_id = $2',
        [userId, roomId]
      );
      
      if (memberCheck.rows.length > 0) {
        socket.join(roomId); // Subscribe the socket to the room
        console.log(`User ${userId} joined room ${roomId}`);
      } else {
        console.warn(`User ${userId} tried to join room ${roomId} but is not a member.`);
      }
    } catch (err) {
      console.error('Join room error:', err);
    }
  });

  // --- 2. SEND MESSAGE ---
  // Client sends this when they hit 'send'
  socket.on('sendMessage', async (data) => {
    const { roomId, content } = data;
    const { userId, firstName, lastName } = socket.user;

    // Security Check: Is the user in the room they're trying to post to?
    if (!socket.rooms.has(roomId)) {
      return console.warn(`User ${userId} tried to send message to room ${roomId} without joining.`);
    }

    if (!content || !roomId) {
      return console.warn(`Invalid message data from user ${userId}`);
    }

    try {
      // 1. Save the new message to the database
      const insertQuery = `
        INSERT INTO messages (content, sender_id, room_id)
        VALUES ($1, $2, $3)
        RETURNING *;
      `;
      const result = await query(insertQuery, [content, userId, roomId]);
      const newDbMessage = result.rows[0];

      // 2. Create the full message payload to broadcast
      const messagePayload = {
        ...newDbMessage,
        first_name: firstName,
        last_name: lastName
      };
      
      // 3. Broadcast the new message to EVERYONE in the room (including the sender)
      io.to(roomId).emit('newMessage', messagePayload);
      console.log(`User ${userId} sent message to room ${roomId}`);
      
    } catch (err)
 {
      console.error('Send message error:', err);
    }
  });

  // --- 3. DISCONNECT ---
  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.user.firstName} (ID: ${socket.user.userId})`);
  });
});

// --- Start the Server ---
const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    // Test the database connection
    const dbResult = await query('SELECT NOW()');
    console.log(`🔌 Database connected successfully at ${dbResult.rows[0].now}`);

    // 6. --- IMPORTANT CHANGE ---
    // Start the HTTP server (which includes Express & Socket.IO)
    // instead of app.listen()
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}.`);
    });
  } catch (err) {
    console.error('❌ Failed to connect to the database:', err);
    process.exit(1);
  }
};

// Call the function to start the server
startServer();