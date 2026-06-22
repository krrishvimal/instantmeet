import express from 'express';
import { exec } from 'child_process';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { User, Connection, Message, Location, SearchResult } from './types';
import { calculateDistance, obfuscateDistance, isValidCoordinate } from './services/geoService';
import { dbService, isFallbackMode } from './services/dbService';

dotenv.config();

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST'],
}));
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

// --- Multiplayer Game States ---
interface GameSession {
  gameType: 'tictactoe' | 'drawguess';
  scores: { [userId: string]: number };
  tictactoe?: {
    board: (string | null)[];
    turn: string;
    winner: string | null;
  };
  drawguess?: {
    drawerId: string;
    word: string;
    hint: string;
    incorrectGuesses: string[];
  };
}

const activeGames = new Map<string, GameSession>();

const DRAW_GUESS_WORDS = [
  'apple', 'banana', 'sun', 'house', 'car', 'tree', 'flower', 'fish', 'star', 'bird', 'moon', 'cake', 'hat',
  'dog', 'cat', 'elephant', 'rocket', 'guitar', 'laptop', 'hamburger', 'pizza', 'clock', 'balloon', 'umbrella',
  'giraffe', 'dolphin', 'spider', 'butterfly', 'penguin', 'airplane', 'train', 'submarine', 'castle', 'bridge'
];

const generateHint = (word: string) => {
  return '_ '.repeat(word.length).trim();
};

// Admin & Moderation states
const reportsCount = new Map<string, number>();
const bannedUsers = new Set<string>();
const adminSockets = new Set<string>();
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'admin123';

// Bootstrap active database data on startup
async function bootstrapDatabase() {
  if (isFallbackMode) return;
  console.log('[Database] Bootstrapping cache data from Supabase...');
  try {
    const activeUsers = await dbService.getActiveUsers();
    const now = Date.now();
    const STALE_THRESHOLD_MS = 30 * 60 * 1000;
    let loadedCount = 0;
    let staleCount = 0;

    for (const user of activeUsers) {
      if (now - user.lastActive > STALE_THRESHOLD_MS) {
        // Delete stale user and their connections on startup
        await dbService.deleteActiveUser(user.id);
        staleCount++;
      } else {
        // Start offline, will be re-registered on socket connect
        user.isOnline = false;
        users.set(user.id, user);
        await dbService.saveActiveUser(user); // Sync is_online: false to database
        loadedCount++;
      }
    }
    console.log(`[Database] Loaded ${loadedCount} active user sessions (${staleCount} stale deleted).`);

    const activeConns = await dbService.getActiveConnections();
    activeConns.forEach((conn) => {
      connections.set(conn.id, {
        id: conn.id,
        user1Id: conn.user1Id,
        user2Id: conn.user2Id,
        status: 'anonymous',
        user1Reveal: false,
        user2Reveal: false,
        messages: [],
        createdAt: Date.now(),
      });
    });
    console.log(`[Database] Loaded ${activeConns.length} connection links.`);

    const banned = await dbService.getBannedUsers();
    banned.forEach((uId) => bannedUsers.add(uId));
    console.log(`[Database] Loaded ${banned.length} banned user IDs.`);

    const reports = await dbService.getReportsCount();
    reports.forEach((count, uId) => reportsCount.set(uId, count));
    console.log(`[Database] Loaded reports count for ${reports.size} users.`);
  } catch (e) {
    console.error('[Database] Bootstrap failed:', e);
  }
}
bootstrapDatabase();

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

  // Calculate city activity breakdown based on online users
  const cityStats: { [city: string]: number } = {};
  users.forEach((user) => {
    if (user.isOnline) {
      const city = user.city || 'Mumbai';
      cityStats[city] = (cityStats[city] || 0) + 1;
    }
  });

  const stats = {
    activeUsersCount: users.size,
    activeConnectionsCount: connections.size,
    reports: reportsList,
    banned: bannedList,
    cities: cityStats,
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
  socket.on('register-user', async (data: {
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
    if (rateLimitCheck(socket.id, 'register-user', 15)) { socket.emit('error-msg', 'Rate limit exceeded. Please slow down.'); return; }

    const userId = data.userId || `user-${Math.random().toString(36).substring(2, 9)}`;
    
    // Cancel any pending disconnect cleanup if user reconnects
    if (disconnectTimeouts.has(userId)) {
      clearTimeout(disconnectTimeouts.get(userId)!);
      disconnectTimeouts.delete(userId);
      console.log(`User reconnected, cancelled cleanup for: ${data.alias} (${userId})`);
    }

    // Reject banned users immediately
    if (bannedUsers.has(userId) || (await dbService.isUserBanned(userId))) {
      bannedUsers.add(userId);
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
    await dbService.saveActiveUser(newUser);
    socket.emit('registration-success', { userId, alias: newUser.alias });
    console.log(`User registered: ${newUser.alias} (${userId}) at location [${newUser.location.lat}, ${newUser.location.lng}]`);
    broadcastAdminStats();

    // Notify users who subscribed to alerts for this city
    users.forEach((otherUser) => {
      if (otherUser.id !== userId && otherUser.isOnline && otherUser.subscribedCityAlerts === newUser.city) {
        // Mutual gender preference filter
        if (newUser.genderPreference !== 'any' && newUser.genderPreference !== otherUser.gender) return;
        if (otherUser.genderPreference !== 'any' && otherUser.genderPreference !== newUser.gender) return;

        if (otherUser.socketId) {
          io.to(otherUser.socketId).emit('city-alert-new-user', {
            city: newUser.city,
            alias: newUser.alias
          });
        }
      }
    });
  });

  // Handle subscribing to city alerts
  socket.on('subscribe-city-alerts', (data: { userId: string; city: string }) => {
    if (rateLimitCheck(socket.id, 'subscribe-city-alerts', 10)) {
      socket.emit('error-msg', 'Rate limit exceeded. Please slow down.');
      return;
    }
    const user = users.get(data.userId);
    if (user) {
      user.subscribedCityAlerts = data.city;
      users.set(data.userId, user);
      console.log(`User ${user.alias} subscribed to alerts for city: ${data.city}`);
      socket.emit('subscribe-city-alerts-success', { city: data.city });
    } else {
      socket.emit('error-msg', 'User session not found.');
    }
  });

  // Handle location update heartbeats
  socket.on('update-location', async (data: { userId: string; location: Location }) => {
    const user = users.get(data.userId);
    if (user && isValidCoordinate(data.location)) {
      user.location = data.location;
      user.lastActive = Date.now();
      user.socketId = socket.id;
      user.isOnline = true;
      users.set(data.userId, user);
      await dbService.saveActiveUser(user);
      
      // Notify client that location has synced
      socket.emit('location-synced', { location: user.location });
    }
  });

  // Search for nearby users (dynamic radius from client, max 50 km)
  socket.on('search-nearby', (data: { userId: string; radius?: number; global?: boolean }) => {
    if (rateLimitCheck(socket.id, 'search-nearby', 40)) { socket.emit('error-msg', 'Rate limit exceeded. Please slow down.'); return; }

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
        fromUserAvatarUrl: fromUser.avatarUrl,
        message: data.message || 'Waved at you! 👋',
      });
    }
  });

  // Accept wave / connection request
  socket.on('accept-connection-request', async (data: { connectionId: string; userId: string }) => {
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
    await dbService.saveConnection(data.connectionId, conn.user1Id, conn.user2Id);

    // Notify initiator
    if (partnerUser.socketId && partnerUser.isOnline) {
      io.to(partnerUser.socketId).emit('connection-accepted', {
        connectionId: conn.id,
        partnerAlias: currentUser.alias,
        partnerId: currentUser.id,
        partnerAvatarUrl: currentUser.avatarUrl,
      });
    }

    // Notify accepter
    socket.emit('connection-accepted', {
      connectionId: conn.id,
      partnerAlias: partnerUser.alias,
      partnerId: partnerUser.id,
      partnerAvatarUrl: partnerUser.avatarUrl,
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
  socket.on('block-user', async (data: { connectionId: string; userId: string }) => {
    const conn = connections.get(data.connectionId);
    if (!conn) return;

    conn.status = 'blocked';
    connections.set(data.connectionId, conn);
    await dbService.deleteConnection(data.connectionId);

    const partnerId = conn.user1Id === data.userId ? conn.user2Id : conn.user1Id;
    const partner = users.get(partnerId);

    socket.emit('user-blocked-success', { connectionId: conn.id });

    if (partner && partner.socketId && partner.isOnline) {
      io.to(partner.socketId).emit('connection-blocked', { connectionId: conn.id });
    }
    broadcastAdminStats();
  });

  // Handle silent connection deletion
  socket.on('delete-connection', async (data: { connectionId: string; userId: string }) => {
    const conn = connections.get(data.connectionId);
    if (!conn) return;

    connections.delete(data.connectionId);
    await dbService.deleteConnection(data.connectionId);

    const partnerId = conn.user1Id === data.userId ? conn.user2Id : conn.user1Id;
    const partner = users.get(partnerId);

    if (partner && partner.socketId && partner.isOnline) {
      io.to(partner.socketId).emit('connection-blocked', { connectionId: conn.id });
    }
    broadcastAdminStats();
  });

  // Handle reporting a user
  socket.on('report-user', async (data: { connectionId: string; reporterId: string; targetUserId: string }) => {
    const conn = connections.get(data.connectionId);
    if (conn) {
      connections.delete(data.connectionId);
      await dbService.deleteConnection(data.connectionId);
      
      const targetUser = users.get(data.targetUserId);
      if (targetUser && targetUser.socketId && targetUser.isOnline) {
        io.to(targetUser.socketId).emit('connection-blocked', { connectionId: data.connectionId });
      }
    }

    // Save report to database
    await dbService.saveReport(data.reporterId, data.targetUserId, data.connectionId);

    // Increment reports count
    const count = (reportsCount.get(data.targetUserId) || 0) + 1;
    reportsCount.set(data.targetUserId, count);
    console.log(`[REPORT] User ${data.targetUserId} reported. Total flags: ${count}`);

    // If threshold reached (>= 3 reports), ban user immediately
    if (count >= 3) {
      bannedUsers.add(data.targetUserId);
      await dbService.saveBannedUser(data.targetUserId);
      console.log(`[BAN] Banning user ${data.targetUserId} due to multiple reports.`);

      const targetUser = users.get(data.targetUserId);
      if (targetUser) {
        const targetSocketId = targetUser.socketId;
        users.delete(data.targetUserId);
        await dbService.deleteActiveUser(data.targetUserId);

        // Delete all active connections of the banned user
        for (const [cId, c] of connections.entries()) {
          if (c.user1Id === data.targetUserId || c.user2Id === data.targetUserId) {
            const partnerId = c.user1Id === data.targetUserId ? c.user2Id : c.user1Id;
            const partner = users.get(partnerId);
            if (partner && partner.socketId && partner.isOnline) {
              io.to(partner.socketId).emit('connection-blocked', { connectionId: cId });
            }
            connections.delete(cId);
            await dbService.deleteConnection(cId);
          }
        }

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
  socket.on('admin-ban-user', async (data: { targetUserId: string }) => {
    if (!adminSockets.has(socket.id)) {
      socket.emit('error-msg', 'Unauthorized.');
      return;
    }

    bannedUsers.add(data.targetUserId);
    await dbService.saveBannedUser(data.targetUserId);
    console.log(`[ADMIN ACTION] Admin banned user ${data.targetUserId}`);

    const targetUser = users.get(data.targetUserId);
    if (targetUser) {
      const targetSocketId = targetUser.socketId;
      users.delete(data.targetUserId);
      await dbService.deleteActiveUser(data.targetUserId);

      // Clean up connections
      for (const [cId, c] of connections.entries()) {
        if (c.user1Id === data.targetUserId || c.user2Id === data.targetUserId) {
          const partnerId = c.user1Id === data.targetUserId ? c.user2Id : c.user1Id;
          const partner = users.get(partnerId);
          if (partner && partner.socketId && partner.isOnline) {
            io.to(partner.socketId).emit('connection-blocked', { connectionId: cId });
          }
          connections.delete(cId);
          await dbService.deleteConnection(cId);
        }
      }

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
  socket.on('admin-dismiss-reports', async (data: { targetUserId: string }) => {
    if (!adminSockets.has(socket.id)) {
      socket.emit('error-msg', 'Unauthorized.');
      return;
    }

    reportsCount.delete(data.targetUserId);
    await dbService.dismissReports(data.targetUserId);
    console.log(`[ADMIN ACTION] Admin dismissed reports for user ${data.targetUserId}`);
    broadcastAdminStats();
  });

  // Admin unban user
  socket.on('admin-unban-user', async (data: { targetUserId: string }) => {
    if (!adminSockets.has(socket.id)) {
      socket.emit('error-msg', 'Unauthorized.');
      return;
    }

    bannedUsers.delete(data.targetUserId);
    await dbService.removeBannedUser(data.targetUserId);
    console.log(`[ADMIN ACTION] Admin unbanned user ${data.targetUserId}`);
    broadcastAdminStats();
  });

  // Client disconnected
  socket.on('disconnect', async () => {
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
        await dbService.saveActiveUser(user);
      }
      
      console.log(`User disconnected, scheduled cleanup in 15s for: ${user?.alias} (${uId})`);
      broadcastAdminStats();
      
      const timeout = setTimeout(async () => {
        disconnectTimeouts.delete(uId);
        
        const userAlias = users.get(uId)?.alias;
        console.log(`Executing delayed cleanup for user: ${userAlias} (${uId})`);
        
        // 1. Delete user profile completely
        users.delete(uId);
        await dbService.deleteActiveUser(uId);
  
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
        for (const connId of connectionsToDelete) {
          connections.delete(connId);
          await dbService.deleteConnection(connId);
        }
        console.log(`Cleanup complete for user ${userAlias}. Deleted ${connectionsToDelete.length} connections.`);
        broadcastAdminStats();
      }, 15000);

      disconnectTimeouts.set(uId, timeout);
    }

  });

  // --- MULTIPLAYER GAME EVENTS ---

  // Initiates or resets a game
  socket.on('game-start', (data: { connectionId: string; gameType: 'tictactoe' | 'drawguess'; fromUserId: string }) => {
    const conn = connections.get(data.connectionId);
    if (!conn) return;

    const partnerId = conn.user1Id === data.fromUserId ? conn.user2Id : conn.user1Id;
    const partner = users.get(partnerId);

    let session = activeGames.get(data.connectionId);
    if (!session) {
      session = {
        gameType: data.gameType,
        scores: {
          [data.fromUserId]: 0,
          [partnerId]: 0
        }
      };
    } else {
      session.gameType = data.gameType;
    }

    if (data.gameType === 'tictactoe') {
      session.tictactoe = {
        board: Array(9).fill(null),
        turn: data.fromUserId, // Initiator starts first
        winner: null
      };
      session.drawguess = undefined;
    } else if (data.gameType === 'drawguess') {
      const randWord = DRAW_GUESS_WORDS[Math.floor(Math.random() * DRAW_GUESS_WORDS.length)];
      session.drawguess = {
        drawerId: data.fromUserId, // Initiator draws first
        word: randWord,
        hint: generateHint(randWord),
        incorrectGuesses: []
      };
      session.tictactoe = undefined;
    }

    activeGames.set(data.connectionId, session);

    // Broadcast to initiator
    socket.emit('game-started', {
      gameType: session.gameType,
      scores: session.scores,
      tictactoe: session.tictactoe,
      drawguess: session.drawguess ? {
        drawerId: session.drawguess.drawerId,
        hint: session.drawguess.hint,
        word: session.drawguess.word // Drawer gets secret word
      } : undefined
    });

    // Broadcast to partner
    if (partner && partner.socketId && partner.isOnline) {
      io.to(partner.socketId).emit('game-started', {
        gameType: session.gameType,
        scores: session.scores,
        tictactoe: session.tictactoe,
        drawguess: session.drawguess ? {
          drawerId: session.drawguess.drawerId,
          hint: session.drawguess.hint
          // Guesser does NOT get the secret word!
        } : undefined
      });
    }
  });

  // Tic Tac Toe Move Handler
  socket.on('game-tictactoe-move', (data: { connectionId: string; userId: string; cellIndex: number }) => {
    const session = activeGames.get(data.connectionId);
    if (!session || session.gameType !== 'tictactoe' || !session.tictactoe) return;

    const ttt = session.tictactoe;
    if (ttt.turn !== data.userId) return; // Not their turn
    if (ttt.board[data.cellIndex] !== null) return; // Cell already filled

    const conn = connections.get(data.connectionId);
    if (!conn) return;

    const partnerId = conn.user1Id === data.userId ? conn.user2Id : conn.user1Id;
    const partner = users.get(partnerId);

    // Place token (X for user1, O for user2)
    const token = data.userId === conn.user1Id ? 'X' : 'O';
    ttt.board[data.cellIndex] = token;

    // Check win condition
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
      [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    let hasWon = false;
    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (ttt.board[a] && ttt.board[a] === ttt.board[b] && ttt.board[a] === ttt.board[c]) {
        hasWon = true;
        break;
      }
    }

    if (hasWon) {
      ttt.winner = data.userId;
      session.scores[data.userId] = (session.scores[data.userId] || 0) + 1;
    } else if (ttt.board.every(cell => cell !== null)) {
      ttt.winner = 'draw';
    } else {
      // Toggle turn
      ttt.turn = partnerId;
    }

    // Broadcast updated state to both
    const updatePayload = {
      board: ttt.board,
      turn: ttt.turn,
      winner: ttt.winner,
      scores: session.scores
    };

    socket.emit('game-tictactoe-state', updatePayload);
    if (partner && partner.socketId && partner.isOnline) {
      io.to(partner.socketId).emit('game-tictactoe-state', updatePayload);
    }
  });

  // Draw & Guess Stroke Synchronization
  socket.on('game-draw-stroke', (data: { connectionId: string; stroke: any }) => {
    const conn = connections.get(data.connectionId);
    if (!conn) return;
    const u1 = users.get(conn.user1Id);
    const u2 = users.get(conn.user2Id);
    const partner = (u1 && u1.socketId === socket.id) ? u2 : u1;
    if (partner && partner.socketId && partner.isOnline) {
      io.to(partner.socketId).emit('game-draw-stroke', data.stroke);
    }
  });

  // Draw & Guess Clear Canvas
  socket.on('game-draw-clear', (data: { connectionId: string }) => {
    const conn = connections.get(data.connectionId);
    if (!conn) return;
    const u1 = users.get(conn.user1Id);
    const u2 = users.get(conn.user2Id);
    const partner = (u1 && u1.socketId === socket.id) ? u2 : u1;
    if (partner && partner.socketId && partner.isOnline) {
      io.to(partner.socketId).emit('game-draw-clear');
    }
  });

  // Draw & Guess Guess Handler
  socket.on('game-draw-guess', (data: { connectionId: string; guess: string; userId: string }) => {
    const session = activeGames.get(data.connectionId);
    if (!session || session.gameType !== 'drawguess' || !session.drawguess) return;

    const dg = session.drawguess;
    if (dg.drawerId === data.userId) return; // Drawer cannot guess!

    const conn = connections.get(data.connectionId);
    if (!conn) return;

    const partnerId = conn.user1Id === data.userId ? conn.user2Id : conn.user1Id;
    const partner = users.get(partnerId); // Drawer

    const normalizedGuess = data.guess.trim().toLowerCase();
    const normalizedWord = dg.word.trim().toLowerCase();

    if (normalizedGuess === normalizedWord) {
      // Correct Guess!
      session.scores[data.userId] = (session.scores[data.userId] || 0) + 1;

      // Select new word & swap roles
      const nextWord = DRAW_GUESS_WORDS[Math.floor(Math.random() * DRAW_GUESS_WORDS.length)];
      const nextDrawerId = partnerId === conn.user1Id ? conn.user2Id : conn.user1Id; // Swap drawer

      dg.word = nextWord;
      dg.hint = generateHint(nextWord);
      dg.drawerId = nextDrawerId;
      dg.incorrectGuesses = [];

      const correctPayload = {
        winnerId: data.userId,
        scores: session.scores,
        correctWord: normalizedWord,
        nextDrawerId: dg.drawerId,
        nextHint: dg.hint
      };

      // Emit correct guess celebration event to both
      socket.emit('game-draw-correct', correctPayload);
      if (partner && partner.socketId && partner.isOnline) {
        io.to(partner.socketId).emit('game-draw-correct', correctPayload);
      }

      // Send the secret word to the new drawer, and just the hint/drawerId to the new guesser
      const newDrawer = users.get(dg.drawerId);
      const newGuesser = users.get(dg.drawerId === conn.user1Id ? conn.user2Id : conn.user1Id);

      if (newDrawer && newDrawer.socketId && newDrawer.isOnline) {
        io.to(newDrawer.socketId).emit('game-draw-new-round', {
          drawerId: dg.drawerId,
          hint: dg.hint,
          word: dg.word,
          scores: session.scores
        });
      }
      if (newGuesser && newGuesser.socketId && newGuesser.isOnline) {
        io.to(newGuesser.socketId).emit('game-draw-new-round', {
          drawerId: dg.drawerId,
          hint: dg.hint,
          scores: session.scores
        });
      }
    } else {
      // Incorrect Guess
      dg.incorrectGuesses.push(data.guess);
      // Broadcast incorrect guess to the drawer
      if (partner && partner.socketId && partner.isOnline) {
        io.to(partner.socketId).emit('game-draw-incorrect-guess', { guess: data.guess });
      }
    }
  });

  // Exit Game Handler
  socket.on('game-exit', (data: { connectionId: string }) => {
    activeGames.delete(data.connectionId);
    
    const conn = connections.get(data.connectionId);
    if (!conn) return;

    // Find who called it and tell the partner
    const u1 = users.get(conn.user1Id);
    const u2 = users.get(conn.user2Id);
    const partner = (u1 && u1.socketId === socket.id) ? u2 : u1;
    if (partner && partner.socketId && partner.isOnline) {
      io.to(partner.socketId).emit('game-exited');
    }
  });

});

// --- Stale User Cleanup (every 5 minutes, 30-minute inactivity threshold) ---
const STALE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const STALE_THRESHOLD_MS = 30 * 60 * 1000;

setInterval(async () => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [userId, user] of users.entries()) {
    if (now - user.lastActive > STALE_THRESHOLD_MS) {
      user.isOnline = false;
      users.delete(userId);
      await dbService.deleteActiveUser(userId);

      // Clean up connections involving this stale user
      const connectionsToDelete: string[] = [];
      connections.forEach((conn, connId) => {
        if (conn.user1Id === userId || conn.user2Id === userId) {
          const partnerId = conn.user1Id === userId ? conn.user2Id : conn.user1Id;
          const partner = users.get(partnerId);
          if (partner && partner.socketId && partner.isOnline) {
            io.to(partner.socketId).emit('connection-blocked', { connectionId: connId });
          }
          connectionsToDelete.push(connId);
        }
      });

      for (const connId of connectionsToDelete) {
        connections.delete(connId);
        await dbService.deleteConnection(connId);
      }

      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`[Stale Cleanup] Removed ${cleanedCount} inactive user(s) and synced to database.`);
    broadcastAdminStats();
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
