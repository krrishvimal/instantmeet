import express from 'express';
import { exec } from 'child_process';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { User, Connection, Message, Location, SearchResult } from './types';
import { calculateDistance, obfuscateDistance, isValidCoordinate } from './services/geoService';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- Rate Limiter (in-memory, per socket) ---
const rateLimitStore = new Map<string, Map<string, number[]>>();

function rateLimitCheck(socketId: string, event: string, maxPerMinute: number): boolean {
  if (!rateLimitStore.has(socketId)) {
    rateLimitStore.set(socketId, new Map());
  }
  const socketEvents = rateLimitStore.get(socketId)!;
  const now = Date.now();
  const windowMs = 60_000;

  if (!socketEvents.has(event)) {
    socketEvents.set(event, []);
  }
  const timestamps = socketEvents.get(event)!;
  // Remove entries outside the 1-minute window
  const recent = timestamps.filter((t) => now - t < windowMs);
  socketEvents.set(event, recent);

  if (recent.length >= maxPerMinute) {
    return true; // rate limit exceeded
  }
  recent.push(now);
  return false;
}

// --- Input Sanitization ---
function sanitizeText(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// --- Health Check Endpoint ---
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), connections: users.size });
});

// In-memory data stores (simulating Supabase & Redis)
const users = new Map<string, User>();
const connections = new Map<string, Connection>();
const disconnectTimeouts = new Map<string, NodeJS.Timeout>();

// Admin & Moderation states
const reportsCount = new Map<string, number>();
const bannedUsers = new Set<string>();
const adminSockets = new Set<string>();
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'admin123';

function broadcastAdminStats() {
  const reportsList: Array<{ userId: string; alias: string; age: number; reports: number }> = [];
  reportsCount.forEach((count, uId) => {
    const user = users.get(uId);
    reportsList.push({
      userId: uId,
      alias: user?.alias || 'Unknown',
      age: user?.age || 0,
      reports: count,
    });
  });

  const bannedList = Array.from(bannedUsers);

  const stats = {
    activeUsersCount: users.size,
    activeConnectionsCount: connections.size,
    reports: reportsList,
    banned: bannedList,
  };

  adminSockets.forEach((adminSocketId) => {
    io.to(adminSocketId).emit('admin-stats-update', stats);
  });
}





io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Clean up rate-limit data when this socket disconnects
  socket.on('disconnect', () => {
    rateLimitStore.delete(socket.id);
  });

  // Register or reconnect active user
  socket.on('register-user', (data: {
    userId?: string;
    alias: string;
    realName: string;
    avatarUrl: string;
    interests: string[];
    age: number;
    gender?: string;
    genderPreference?: string;
    city: string;
    location: Location;
    isVisible?: boolean;
    stealthMode?: boolean;
  }) => {
    if (rateLimitCheck(socket.id, 'register-user', 5)) { socket.emit('error-msg', 'Rate limit exceeded. Please slow down.'); return; }

    const userId = data.userId || `user-${Math.random().toString(36).substring(2, 9)}`;
    
    // Cancel any pending disconnect cleanup if user reconnects
    if (disconnectTimeouts.has(userId)) {
      clearTimeout(disconnectTimeouts.get(userId)!);
      disconnectTimeouts.delete(userId);
      console.log(`User reconnected, cancelled cleanup for: ${data.alias} (${userId})`);
    }

    // Reject banned users immediately
    if (bannedUsers.has(userId)) {
      socket.emit('error-msg', 'You have been banned from the platform due to multiple community reports.');
      socket.disconnect(true);
      return;
    }


    
    if (!isValidCoordinate(data.location)) {
      socket.emit('error-msg', 'Invalid geospatial coordinates provided.');
      return;
    }

    // Sanitize & validate inputs
    const alias = sanitizeText(data.alias).substring(0, 30);
    const realName = sanitizeText(data.realName).substring(0, 50);
    const age = Math.max(13, Math.min(120, data.age));
    const interests = (data.interests || []).slice(0, 10);

    if (!alias) {
      socket.emit('error-msg', 'Alias is required.');
      return;
    }

    const newUser: User = {
      id: userId,
      alias,
      realName,
      avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${alias}`,
      interests,
      age,
      gender: data.gender || 'male',
      genderPreference: data.genderPreference || 'any',
      city: data.city || 'Mumbai',
      location: data.location,
      lastActive: Date.now(),
      socketId: socket.id,
      isOnline: true,
      isVisible: data.isVisible !== false, // default true
      stealthMode: data.stealthMode === true, // default false
    };

    users.set(userId, newUser);
    socket.emit('registration-success', { userId, alias: newUser.alias });
    console.log(`User registered: ${newUser.alias} (${userId}) at location [${newUser.location.lat}, ${newUser.location.lng}]`);
    broadcastAdminStats();
  });

  // Handle location update heartbeats
  socket.on('update-location', (data: { userId: string; location: Location }) => {
    const user = users.get(data.userId);
    if (user && isValidCoordinate(data.location)) {
      user.location = data.location;
      user.lastActive = Date.now();
      user.socketId = socket.id;
      user.isOnline = true;
      users.set(data.userId, user);
      
      // Notify client that location has synced
      socket.emit('location-synced', { location: user.location });
    }
  });

  // Search for nearby users (dynamic radius from client, max 50 km)
  socket.on('search-nearby', (data: { userId: string; radius?: number; global?: boolean }) => {
    if (rateLimitCheck(socket.id, 'search-nearby', 20)) { socket.emit('error-msg', 'Rate limit exceeded. Please slow down.'); return; }

    const currentUser = users.get(data.userId);
    if (!currentUser) {
      socket.emit('error-msg', 'User not registered or session expired.');
      return;
    }

    const searchResults: SearchResult[] = [];

    users.forEach((otherUser) => {
      // Don't match with self
      if (otherUser.id === currentUser.id) return;
      
      // Only match active/online users
      if (!otherUser.isOnline) return;

      // Skip users who turned off "Visible on Radar"
      if (!otherUser.isVisible) return;

      // Mutual gender preference filter
      if (currentUser.genderPreference !== 'any' && currentUser.genderPreference !== otherUser.gender) return;
      if (otherUser.genderPreference !== 'any' && otherUser.genderPreference !== currentUser.gender) return;

      // City filter check (strict matching by city name) - skip if global search is requested
      if (!data.global && currentUser.city !== otherUser.city) return;

      // If target user has stealth mode ON, hide interests & age
      searchResults.push({
        userId: otherUser.id,
        alias: otherUser.alias,
        interests: otherUser.stealthMode ? [] : otherUser.interests,
        age: otherUser.stealthMode ? 0 : otherUser.age,
        gender: otherUser.gender,
        distanceKm: 0,
        isOnline: otherUser.isOnline,
        city: otherUser.city,
      });
    });

    // Send back matching users list
    socket.emit('nearby-results', { results: searchResults, isGlobal: !!data.global });
  });

  // Send wave / connection request
  socket.on('send-connection-request', (data: { fromUserId: string; toUserId: string; message?: string }) => {
    if (rateLimitCheck(socket.id, 'send-connection-request', 10)) { socket.emit('error-msg', 'Rate limit exceeded. Please slow down.'); return; }

    // Sanitize optional message
    if (data.message) {
      data.message = sanitizeText(data.message).substring(0, 2000);
    }

    const fromUser = users.get(data.fromUserId);
    const toUser = users.get(data.toUserId);

    if (!fromUser || !toUser) {
      socket.emit('error-msg', 'User session not found.');
      return;
    }

    // Check if a connection already exists
    const connectionKey1 = `${data.fromUserId}_${data.toUserId}`;
    const connectionKey2 = `${data.toUserId}_${data.fromUserId}`;
    const existingConn = connections.get(connectionKey1) || connections.get(connectionKey2);

    if (existingConn) {
      socket.emit('error-msg', 'A connection or request already exists between you two.');
      return;
    }

    const connId = `conn-${Math.random().toString(36).substring(2, 9)}`;
    const newConnection: Connection = {
      id: connId,
      user1Id: data.fromUserId,
      user2Id: data.toUserId,
      status: 'anonymous',
      user1Reveal: false,
      user2Reveal: false,
      messages: [],
      createdAt: Date.now(),
    };

    connections.set(connId, newConnection);
  
    // Real user notification
    if (toUser.socketId && toUser.isOnline) {
      io.to(toUser.socketId).emit('incoming-connection-request', {
        connectionId: connId,
        fromUserId: fromUser.id,
        fromUserAlias: fromUser.alias,
        message: data.message || 'Waved at you! 👋',
      });
    }
  });

  // Accept wave / connection request
  socket.on('accept-connection-request', (data: { connectionId: string; userId: string }) => {
    const conn = connections.get(data.connectionId);
    if (!conn) {
      socket.emit('error-msg', 'Connection request not found.');
      return;
    }

    const partnerId = conn.user1Id === data.userId ? conn.user2Id : conn.user1Id;
    const partnerUser = users.get(partnerId);
    const currentUser = users.get(data.userId);

    if (!partnerUser || !currentUser) {
      socket.emit('error-msg', 'User not found.');
      return;
    }

    // Update connection status
    conn.status = 'anonymous';
    connections.set(data.connectionId, conn);

    // Notify initiator
    if (partnerUser.socketId && partnerUser.isOnline) {
      io.to(partnerUser.socketId).emit('connection-accepted', {
        connectionId: conn.id,
        partnerAlias: currentUser.alias,
        partnerId: currentUser.id,
      });
    }

    // Notify accepter
    socket.emit('connection-accepted', {
      connectionId: conn.id,
      partnerAlias: partnerUser.alias,
      partnerId: partnerUser.id,
    });
  });

  // Handle live chat messages
  socket.on('send-message', (data: { connectionId: string; senderId: string; text: string }) => {
    if (rateLimitCheck(socket.id, 'send-message', 60)) { socket.emit('error-msg', 'Rate limit exceeded. Please slow down.'); return; }

    // Sanitize & validate message text
    data.text = sanitizeText(data.text).substring(0, 2000);
    if (!data.text) {
      socket.emit('error-msg', 'Message cannot be empty.');
      return;
    }

    const conn = connections.get(data.connectionId);
    if (!conn || conn.status === 'blocked') {
      socket.emit('error-msg', 'Active connection chat not found.');
      return;
    }

    const sender = users.get(data.senderId);
    if (!sender) return;

    const newMessage: Message = {
      id: `msg-${Math.random().toString(36).substring(2, 9)}`,
      connectionId: data.connectionId,
      senderId: data.senderId,
      senderAlias: conn.status === 'revealed' ? sender.realName : sender.alias,
      text: data.text,
      timestamp: Date.now(),
    };

    conn.messages.push(newMessage);
    connections.set(data.connectionId, conn);

    const recipientId = conn.user1Id === data.senderId ? conn.user2Id : conn.user1Id;
    const recipient = users.get(recipientId);
  
    // Send to sender (echo) and recipient
    socket.emit('chat-message', newMessage);
  
    if (recipient && recipient.socketId && recipient.isOnline) {
      io.to(recipient.socketId).emit('chat-message', newMessage);
    }
  });

  // Handle reveal request
  socket.on('request-reveal', (data: { connectionId: string; userId: string }) => {
    const conn = connections.get(data.connectionId);
    if (!conn) return;

    const isUser1 = conn.user1Id === data.userId;
    if (isUser1) {
      conn.user1Reveal = true;
    } else {
      conn.user2Reveal = true;
    }

    connections.set(data.connectionId, conn);

    const partnerId = isUser1 ? conn.user2Id : conn.user1Id;
    const partner = users.get(partnerId);
    const currentUser = users.get(data.userId);

    if (!partner || !currentUser) return;

    // Check if BOTH users have requested reveal
    if (conn.user1Reveal && conn.user2Reveal) {
      conn.status = 'revealed';
      connections.set(data.connectionId, conn);

      const revealData = {
        connectionId: conn.id,
        user1: {
          id: conn.user1Id,
          realName: users.get(conn.user1Id)?.realName || '',
          avatarUrl: users.get(conn.user1Id)?.avatarUrl || '',
        },
        user2: {
          id: conn.user2Id,
          realName: users.get(conn.user2Id)?.realName || '',
          avatarUrl: users.get(conn.user2Id)?.avatarUrl || '',
        },
      };

      // Notify both sockets of mutual reveal
      socket.emit('mutual-reveal', revealData);
      if (partner.socketId && partner.isOnline) {
        io.to(partner.socketId).emit('mutual-reveal', revealData);
      }
    } else {
      // Notify partner that a reveal request is pending
      if (partner.socketId && partner.isOnline) {
        io.to(partner.socketId).emit('partner-requested-reveal', {
          connectionId: conn.id,
        });
      }
    }
  });

  // Handle loading chat history
  socket.on('get-chat-history', (data: { connectionId: string }) => {
    const conn = connections.get(data.connectionId);
    if (conn) {
      const user1 = users.get(conn.user1Id);
      const user2 = users.get(conn.user2Id);
      socket.emit('chat-history', {
        connectionId: data.connectionId,
        messages: conn.messages,
        status: conn.status,
        user1Reveal: conn.user1Reveal,
        user2Reveal: conn.user2Reveal,
        user1: user1 ? { id: user1.id, realName: user1.realName, avatarUrl: user1.avatarUrl } : null,
        user2: user2 ? { id: user2.id, realName: user2.realName, avatarUrl: user2.avatarUrl } : null,
      });
    }
  });

  // Handle blocking
  socket.on('block-user', (data: { connectionId: string; userId: string }) => {
    const conn = connections.get(data.connectionId);
    if (!conn) return;

    conn.status = 'blocked';
    connections.set(data.connectionId, conn);

    const partnerId = conn.user1Id === data.userId ? conn.user2Id : conn.user1Id;
    const partner = users.get(partnerId);

    socket.emit('user-blocked-success', { connectionId: conn.id });

    if (partner && partner.socketId && partner.isOnline) {
      io.to(partner.socketId).emit('connection-blocked', { connectionId: conn.id });
    }
    broadcastAdminStats();
  });

  // Handle silent connection deletion
  socket.on('delete-connection', (data: { connectionId: string; userId: string }) => {
    const conn = connections.get(data.connectionId);
    if (!conn) return;

    connections.delete(data.connectionId);

    const partnerId = conn.user1Id === data.userId ? conn.user2Id : conn.user1Id;
    const partner = users.get(partnerId);

    if (partner && partner.socketId && partner.isOnline) {
      io.to(partner.socketId).emit('connection-blocked', { connectionId: conn.id });
    }
    broadcastAdminStats();
  });

  // Handle reporting a user
  socket.on('report-user', (data: { connectionId: string; reporterId: string; targetUserId: string }) => {
    const conn = connections.get(data.connectionId);
    if (conn) {
      connections.delete(data.connectionId);
      
      const targetUser = users.get(data.targetUserId);
      if (targetUser && targetUser.socketId && targetUser.isOnline) {
        io.to(targetUser.socketId).emit('connection-blocked', { connectionId: data.connectionId });
      }
    }

    // Increment reports count
    const count = (reportsCount.get(data.targetUserId) || 0) + 1;
    reportsCount.set(data.targetUserId, count);
    console.log(`[REPORT] User ${data.targetUserId} reported. Total flags: ${count}`);

    // If threshold reached (>= 3 reports), ban user immediately
    if (count >= 3) {
      bannedUsers.add(data.targetUserId);
      console.log(`[BAN] Banning user ${data.targetUserId} due to multiple reports.`);

      const targetUser = users.get(data.targetUserId);
      if (targetUser) {
        const targetSocketId = targetUser.socketId;
        users.delete(data.targetUserId);

        // Delete all active connections of the banned user
        connections.forEach((c, cId) => {
          if (c.user1Id === data.targetUserId || c.user2Id === data.targetUserId) {
            const partnerId = c.user1Id === data.targetUserId ? c.user2Id : c.user1Id;
            const partner = users.get(partnerId);
            if (partner && partner.socketId && partner.isOnline) {
              io.to(partner.socketId).emit('connection-blocked', { connectionId: cId });
            }
            connections.delete(cId);
          }
        });

        if (targetSocketId) {
          const targetSocket = io.sockets.sockets.get(targetSocketId);
          if (targetSocket) {
            targetSocket.emit('error-msg', 'You have been banned from the platform due to multiple community reports.');
            targetSocket.disconnect(true);
          }
        }
      }
    }

    broadcastAdminStats();
  });

  // --- Admin Moderation Console Events ---

  // Admin login request
  socket.on('admin-login', (data: { passcode: string }) => {
    if (data.passcode === ADMIN_PASSCODE) {
      adminSockets.add(socket.id);
      socket.emit('admin-authorized', { success: true });
      
      // Send initial stats immediately
      const reportsList: Array<{ userId: string; alias: string; age: number; reports: number }> = [];
      reportsCount.forEach((count, uId) => {
        const user = users.get(uId);
        reportsList.push({
          userId: uId,
          alias: user?.alias || 'Unknown',
          age: user?.age || 0,
          reports: count,
        });
      });

      const stats = {
        activeUsersCount: users.size,
        activeConnectionsCount: connections.size,
        reports: reportsList,
        banned: Array.from(bannedUsers),
      };
      socket.emit('admin-stats-update', stats);
      console.log(`[ADMIN] Socket ${socket.id} logged in as Admin.`);
    } else {
      socket.emit('error-msg', 'Invalid admin passcode.');
    }
  });

  // Admin manually ban user
  socket.on('admin-ban-user', (data: { targetUserId: string }) => {
    if (!adminSockets.has(socket.id)) {
      socket.emit('error-msg', 'Unauthorized.');
      return;
    }

    bannedUsers.add(data.targetUserId);
    console.log(`[ADMIN ACTION] Admin banned user ${data.targetUserId}`);

    const targetUser = users.get(data.targetUserId);
    if (targetUser) {
      const targetSocketId = targetUser.socketId;
      users.delete(data.targetUserId);

      // Clean up connections
      connections.forEach((c, cId) => {
        if (c.user1Id === data.targetUserId || c.user2Id === data.targetUserId) {
          const partnerId = c.user1Id === data.targetUserId ? c.user2Id : c.user1Id;
          const partner = users.get(partnerId);
          if (partner && partner.socketId && partner.isOnline) {
            io.to(partner.socketId).emit('connection-blocked', { connectionId: cId });
          }
          connections.delete(cId);
        }
      });

      if (targetSocketId) {
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.emit('error-msg', 'You have been banned from the platform by the administrator.');
          targetSocket.disconnect(true);
        }
      }
    }

    broadcastAdminStats();
  });

  // Admin dismiss reports
  socket.on('admin-dismiss-reports', (data: { targetUserId: string }) => {
    if (!adminSockets.has(socket.id)) {
      socket.emit('error-msg', 'Unauthorized.');
      return;
    }

    reportsCount.delete(data.targetUserId);
    console.log(`[ADMIN ACTION] Admin dismissed reports for user ${data.targetUserId}`);
    broadcastAdminStats();
  });

  // Admin unban user
  socket.on('admin-unban-user', (data: { targetUserId: string }) => {
    if (!adminSockets.has(socket.id)) {
      socket.emit('error-msg', 'Unauthorized.');
      return;
    }

    bannedUsers.delete(data.targetUserId);
    console.log(`[ADMIN ACTION] Admin unbanned user ${data.targetUserId}`);
    broadcastAdminStats();
  });

  // Client disconnected
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    adminSockets.delete(socket.id);
    
    // Find the user who disconnected
    let disconnectedUserId: string | null = null;
    users.forEach((user, id) => {
      if (user.socketId === socket.id) {
        disconnectedUserId = id;
      }
    });


    if (disconnectedUserId) {
      const uId = disconnectedUserId;
      const user = users.get(uId);
      if (user) {
        user.isOnline = false;
        users.set(uId, user);
      }
      
      console.log(`User disconnected, scheduled cleanup in 15s for: ${user?.alias} (${uId})`);
      broadcastAdminStats();
      
      const timeout = setTimeout(() => {
        disconnectTimeouts.delete(uId);
        
        const userAlias = users.get(uId)?.alias;
        console.log(`Executing delayed cleanup for user: ${userAlias} (${uId})`);
        
        // 1. Delete user profile completely
        users.delete(uId);
  
        // 2. Clean up all active connections involving this user
        const connectionsToDelete: string[] = [];
        connections.forEach((conn, connId) => {
          if (conn.user1Id === uId || conn.user2Id === uId) {
            const partnerId = conn.user1Id === uId ? conn.user2Id : conn.user1Id;
            const partner = users.get(partnerId);
            
            if (partner && partner.socketId && partner.isOnline) {
              // Notify partner that the chat has been terminated and erased
              io.to(partner.socketId).emit('connection-blocked', { connectionId: connId });
            }
            connectionsToDelete.push(connId);
          }
        });
  
        // 3. Erase connections and messages history completely
        connectionsToDelete.forEach((connId) => {
          connections.delete(connId);
        });
        console.log(`Cleanup complete for user ${userAlias}. Deleted ${connectionsToDelete.length} connections.`);
        broadcastAdminStats();
      }, 15000);

      disconnectTimeouts.set(uId, timeout);
    }

  });
});

// --- Stale User Cleanup (every 5 minutes, 30-minute inactivity threshold) ---
const STALE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const STALE_THRESHOLD_MS = 30 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;

  users.forEach((user, userId) => {
    if (now - user.lastActive > STALE_THRESHOLD_MS) {
      user.isOnline = false;
      users.delete(userId);
      cleanedCount++;
    }
  });

  if (cleanedCount > 0) {
    console.log(`[Stale Cleanup] Removed ${cleanedCount} inactive user(s).`);
  }
}, STALE_CHECK_INTERVAL_MS);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  
  // Log open files limit tip on Unix-based production systems
  if (process.platform !== 'win32') {
    exec('ulimit -n', (err, stdout) => {
      if (!err) {
        const limit = parseInt(stdout.trim());
        console.log(`[System info] Open files limit (rlimit): ${limit}`);
        if (limit < 10000) {
          console.warn(
            `\x1b[33m[Warning] Low open file limit (${limit}) detected. For 5000+ concurrent users, increase it using: ulimit -n 65536\x1b[0m`
          );
        }
      }
    });
  }
});
