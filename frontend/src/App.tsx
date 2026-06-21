// InstantMeet Frontend - Responsive Mobile Web App
import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Radar, 
  ShieldAlert, 
  Send, 
  MapPin, 
  Sparkles, 
  MessageSquare, 
  Compass, 
  Loader2, 
  Lock, 
  CheckCircle2,
  Users,
  Home,
  MessageCircle,
  Settings,
  Bell,
  ChevronRight,
  ShieldCheck,
  Ghost,
  Target,
  Heart,
  Calendar,
  Camera,
  Music,
  Coffee,
  Tag,
  ArrowLeft,
  X
} from 'lucide-react';
import './App.css';

// Production-safe WebSocket URL: uses env variable in production, fallback for dev
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Simple XSS-safe text sanitizer - strips HTML tags
const sanitizeText = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// Type definitions to mirror backend
interface Location {
  lat: number;
  lng: number;
}

interface SearchResult {
  userId: string;
  alias: string;
  interests: string[];
  age: number;
  distanceKm: number;
  isOnline: boolean;
}

interface Message {
  id: string;
  connectionId: string;
  senderId: string;
  senderAlias: string;
  text: string;
  timestamp: number;
}

// Helper to resolve tag configurations based on tag name
const getTagConfig = (tag: string) => {
  const normalized = tag.toLowerCase().trim();
  if (normalized === 'photography') {
    return { 
      icon: <Camera className="w-3.5 h-3.5 text-pink-400" />, 
      color: '#ffffff', 
      bgColor: 'rgba(30, 20, 74, 0.45)', 
      borderColor: 'rgba(244, 114, 182, 0.2)' 
    };
  }
  if (normalized === 'music') {
    return { 
      icon: <Music className="w-3.5 h-3.5 text-violet-400" />, 
      color: '#ffffff', 
      bgColor: 'rgba(30, 20, 74, 0.45)', 
      borderColor: 'rgba(192, 132, 252, 0.2)' 
    };
  }
  if (normalized === 'coffee') {
    return { 
      icon: <Coffee className="w-3.5 h-3.5 text-yellow-500" />, 
      color: '#ffffff', 
      bgColor: 'rgba(30, 20, 74, 0.45)', 
      borderColor: 'rgba(253, 224, 71, 0.2)' 
    };
  }
  // Default fallback style
  return { 
    icon: <Tag className="w-3.5 h-3.5 text-emerald-400" />, 
    color: '#ffffff', 
    bgColor: 'rgba(30, 20, 74, 0.45)', 
    borderColor: 'rgba(52, 211, 153, 0.2)' 
  };
};

// Fixed center coordinates for mock geo-testing
// Toast notification system for replacing native alert()
interface ToastMessage {
  id: string;
  text: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // App Navigation
  const [activeTab, setActiveTab] = useState<'home' | 'connections' | 'chats' | 'settings' | 'admin'>('home');
  const [previousTab, setPreviousTab] = useState<'home' | 'connections' | 'chats' | 'admin'>('home');

  useEffect(() => {
    if (activeTab !== 'settings') {
      setPreviousTab(activeTab as any);
    }
  }, [activeTab]);

  // User Profile Info
  const [userId, setUserId] = useState<string>('');
  const [alias, setAlias] = useState('');
  const [realName, setRealName] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Photography', 'Music', 'Coffee']);
  const [isRegistered, setIsRegistered] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Discovery & Privacy Settings (wired to server)
  const [discoveryRadius, setDiscoveryRadius] = useState(10);
  const [visibleOnRadar, setVisibleOnRadar] = useState(true);
  const [stealthMode, setStealthMode] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Toast notification helper - replaces native alert()
  const showToast = useCallback((text: string, type: ToastMessage['type'] = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // Geolocation & Mocking state
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [locationSynced, setLocationSynced] = useState(false);

  // Discovery / Matching State
  const [isScanning, setIsScanning] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<SearchResult[]>([]);
  const [selectedNode, setSelectedNode] = useState<SearchResult | null>(null);

  // Chat / Connection State
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [activePartner, setActivePartner] = useState<{ id: string; alias: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [typedMessage, setTypedMessage] = useState('');
  
  // Reveal / Safety State
  const [revealRequested, setRevealRequested] = useState(false);
  const [partnerRevealPending, setPartnerRevealPending] = useState(false);
  const [revealedProfiles, setRevealedProfiles] = useState<{
    user1: { id: string; realName: string; avatarUrl: string };
    user2: { id: string; realName: string; avatarUrl: string };
  } | null>(null);
  const [showParticleEffect, setShowParticleEffect] = useState(false);
  const [incomingRequest, setIncomingRequest] = useState<{
    connectionId: string;
    fromUserId: string;
    fromUserAlias: string;
    message: string;
  } | null>(null);

  // Custom Safety Options Modal State
  const [activeSafetyOptionsConnId, setActiveSafetyOptionsConnId] = useState<string | null>(null);
  const [safetyPartnerAlias, setSafetyPartnerAlias] = useState<string>('');

  // Admin Console State
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminStats, setAdminStats] = useState<{
    activeUsersCount: number;
    activeConnectionsCount: number;
    reports: Array<{ userId: string; alias: string; age: number; reports: number }>;
    banned: string[];
  }>({
    activeUsersCount: 0,
    activeConnectionsCount: 0,
    reports: [],
    banned: [],
  });


  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Real active connections list (no mock/fake data)
  const [activeConnections, setActiveConnections] = useState<{
    id: string; // connectionId
    partnerId: string;
    partnerAlias: string;
    isOnline: boolean;
    isRevealed: boolean;
    realName?: string;
    avatarUrl?: string;
    time: string;
  }[]>([]);

  // Keep ref to avoid stale closures in socket event handlers
  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // Keep latest registration data in a ref to use during auto-reconnection
  const regDataRef = useRef({
    userId,
    alias,
    realName,
    avatarUrl,
    interests: selectedTags,
    age,
    location: currentLocation,
    isVisible: visibleOnRadar,
    stealthMode,
  });

  useEffect(() => {
    regDataRef.current = {
      userId,
      alias,
      realName,
      avatarUrl,
      interests: selectedTags,
      age,
      location: currentLocation,
      isVisible: visibleOnRadar,
      stealthMode,
    };
  }, [userId, alias, realName, avatarUrl, selectedTags, age, currentLocation, visibleOnRadar, stealthMode]);

  // Re-register automatically on reconnect (if user was already registered)
  useEffect(() => {
    if (isConnected && isRegistered && socket) {
      console.log('Socket reconnected, auto-registering user:', regDataRef.current.alias);
      socket.emit('register-user', regDataRef.current);
      
      // If we are currently in an active chat room, sync history to catch up on missed messages
      if (activeConnectionId) {
        socket.emit('get-chat-history', { connectionId: activeConnectionId });
      }
    }
  }, [isConnected, isRegistered, socket, activeConnectionId]);

  // Establish Socket Connection
  useEffect(() => {
    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      setErrorMsg(null);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('error-msg', (msg: string) => {
      setErrorMsg(msg);
      if (msg.toLowerCase().includes('not registered') || msg.toLowerCase().includes('expired')) {
        setIsRegistered(false);
      }
      setTimeout(() => setErrorMsg(null), 5000);
    });


    socketInstance.on('registration-success', (data: { userId: string; alias: string }) => {
      setUserId(data.userId);
      setIsRegistered(true);
    });

    socketInstance.on('incoming-connection-request', (data: {
      connectionId: string;
      fromUserId: string;
      fromUserAlias: string;
      message: string;
    }) => {
      setIncomingRequest(data);
    });

    socketInstance.on('connection-accepted', (data: {
      connectionId: string;
      partnerAlias: string;
      partnerId: string;
    }) => {
      setActiveConnectionId(data.connectionId);
      setActivePartner({ id: data.partnerId, alias: data.partnerAlias });
      setChatMessages([]);
      setRevealRequested(false);
      setPartnerRevealPending(false);
      setRevealedProfiles(null);
      setIncomingRequest(null);

      // Add to active connections
      setActiveConnections((prev) => {
        if (prev.some((c) => c.id === data.connectionId)) return prev;
        return [
          ...prev,
          {
            id: data.connectionId,
            partnerId: data.partnerId,
            partnerAlias: data.partnerAlias,
            isOnline: true,
            isRevealed: false,
            time: 'Just now',
          },
        ];
      });
    });

    socketInstance.on('chat-message', (msg: Message) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    socketInstance.on('partner-requested-reveal', () => {
      setPartnerRevealPending(true);
    });

    socketInstance.on('mutual-reveal', (data: {
      connectionId: string;
      user1: { id: string; realName: string; avatarUrl: string };
      user2: { id: string; realName: string; avatarUrl: string };
    }) => {
      setRevealedProfiles(data);
      setShowParticleEffect(true);
      setTimeout(() => setShowParticleEffect(false), 2500);

      // Update reveal state in connections list
      setActiveConnections((prev) =>
        prev.map((c) => {
          if (c.id === data.connectionId) {
            const partnerData = data.user1.id === userIdRef.current ? data.user2 : data.user1;
            return {
              ...c,
              isRevealed: true,
              realName: partnerData.realName,
              avatarUrl: partnerData.avatarUrl,
            };
          }
          return c;
        })
      );
    });

    socketInstance.on('connection-blocked', (data: { connectionId: string }) => {
      setActiveConnectionId(null);
      setActivePartner(null);
      setActiveConnections((prev) => prev.filter((c) => c.id !== data.connectionId));
      showToast('The chat has been terminated because the other user disconnected or closed their window.', 'warning');
    });

    // Handle loading chat history from server
    socketInstance.on('chat-history', (data: {
      connectionId: string;
      messages: Message[];
      status: string;
      user1Reveal: boolean;
      user2Reveal: boolean;
      user1: { id: string; realName: string; avatarUrl: string } | null;
      user2: { id: string; realName: string; avatarUrl: string } | null;
    }) => {
      setChatMessages(data.messages);
      
      const isUser1 = data.user1?.id === userIdRef.current;
      setRevealRequested(isUser1 ? data.user1Reveal : data.user2Reveal);
      setPartnerRevealPending(isUser1 ? data.user2Reveal : data.user1Reveal);

      if (data.status === 'revealed' && data.user1 && data.user2) {
        setRevealedProfiles({
          user1: data.user1,
          user2: data.user2,
        });
      } else {
        setRevealedProfiles(null);
      }
    });

    socketInstance.on('location-synced', (data: { location: Location }) => {
      setCurrentLocation(data.location);
      setLocationSynced(true);
    });

    socketInstance.on('nearby-results', (results: SearchResult[]) => {
      setNearbyUsers(results);
      setIsScanning(false);
    });

    socketInstance.on('admin-authorized', (data: { success: boolean }) => {
      if (data.success) {
        setIsAdmin(true);
        showToast('Admin Console unlocked!', 'success');
        setActiveTab('admin' as any);
      }
    });

    socketInstance.on('admin-stats-update', (stats: any) => {
      setAdminStats(stats);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Helper to format coordinates in a premium way
  const formatCoords = (loc: Location | null) => {
    if (!loc) return 'Syncing GPS...';
    const latStr = `${Math.abs(loc.lat).toFixed(4)}° ${loc.lat >= 0 ? 'N' : 'S'}`;
    const lngStr = `${Math.abs(loc.lng).toFixed(4)}° ${loc.lng >= 0 ? 'E' : 'W'}`;
    return `${latStr}, ${lngStr}`;
  };

  // Fetch and sync GPS location from browser Geolocation API
  const syncRealLocation = () => {
    setLocationSynced(false);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentLocation(loc);
          setLocationSynced(true);
          if (socket && isRegistered) {
            socket.emit('update-location', { userId, location: loc });
          }
        },
        (err) => {
          console.error('Error fetching real GPS:', err);
          showToast('Location access denied. Please allow location permissions in your browser settings.', 'error');
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      showToast('Geolocation is not supported by your browser.', 'error');
    }
  };

  // Sync real location on mount or when registration is completed
  useEffect(() => {
    syncRealLocation();
  }, [isRegistered, socket, userId]);

  // Scroll to chat bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Submit Profile Registration / Discovery entry
  const handleRegisterOrEnter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!alias.trim()) {
      showToast('Please enter your Display Name first.', 'warning');
      return;
    }
    if (typeof age !== 'number' || isNaN(age)) {
      showToast('Please enter a valid Age.', 'warning');
      return;
    }
    const resolvedRealName = realName.trim() || alias.trim();
    if (selectedTags.length < 2) {
      showToast('Select at least 2 interests to enter.', 'warning');
      return;
    }
    if (!currentLocation) {
      showToast('Waiting for GPS location sync...', 'warning');
      return;
    }

    const generatedAvatar = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${alias}`;
    setAvatarUrl(generatedAvatar);

    if (socket) {
      const finalAge = typeof age !== 'number' || isNaN(age) ? 18 : Math.max(13, Math.min(120, age));
      setAge(finalAge);
      socket.emit('register-user', {
        userId: userId || undefined,
        alias,
        realName: resolvedRealName,
        avatarUrl: generatedAvatar,
        interests: selectedTags,
        age: finalAge,
        location: currentLocation,
        isVisible: visibleOnRadar,
        stealthMode,
      });
    }
  };

  // Add custom interest tag
  const handleAddTag = () => {
    if (newTagInput.trim() && !selectedTags.includes(newTagInput.trim())) {
      setSelectedTags([...selectedTags, newTagInput.trim()]);
      setNewTagInput('');
    }
  };

  // Trigger discovery search
  const handleSearch = () => {
    if (!socket || !userId) return;
    setIsScanning(true);
    setSelectedNode(null);
    socket.emit('search-nearby', { userId, radius: discoveryRadius });
  };

  // Send wave / connection request
  const handleSendWave = () => {
    if (!socket || !selectedNode) return;
    socket.emit('send-connection-request', {
      fromUserId: userId,
      toUserId: selectedNode.userId,
      message: `👋 Hey! I like #${selectedNode.interests[0]} too! Let's chat.`,
    });
    showToast(`Wave sent to @${selectedNode.alias}! 👋`, 'success');
    setSelectedNode(null);
  };

  // Accept incoming connection request
  const handleAcceptRequest = () => {
    if (!socket || !incomingRequest) return;
    socket.emit('accept-connection-request', {
      connectionId: incomingRequest.connectionId,
      userId,
    });
  };

  // Click on a connection card to open chat room and load history
  const handleRecentCardClick = (conn: any) => {
    if (!isRegistered) {
      showToast('Please enter the Discovery Bubble first by completing your profile!', 'warning');
      return;
    }
    setActiveConnectionId(conn.id);
    setActivePartner({ id: conn.partnerId, alias: conn.partnerAlias });
    if (socket) {
      socket.emit('get-chat-history', { connectionId: conn.id });
    }
  };

  // Send message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !activeConnectionId || !typedMessage.trim()) return;

    socket.emit('send-message', {
      connectionId: activeConnectionId,
      senderId: userId,
      text: typedMessage.trim(),
    });
    setTypedMessage('');
  };

  // Trigger reveal identity request
  const handleRequestReveal = () => {
    if (!socket || !activeConnectionId) return;
    setRevealRequested(true);
    socket.emit('request-reveal', {
      connectionId: activeConnectionId,
      userId,
    });
  };

  // Safety actions (Delete, Block, Report)
  const handleSafetyAction = (action: 'delete' | 'block' | 'report', connectionId: string) => {
    if (!socket) return;
    
    if (action === 'delete') {
      if (activeConnectionId === connectionId) {
        setActiveConnectionId(null);
        setActivePartner(null);
      }
      setActiveConnections(prev => prev.filter(c => c.id !== connectionId));
      socket.emit('delete-connection', { connectionId, userId });
      showToast('Chat history deleted.', 'info');
    } 
    else if (action === 'block') {
      if (activeConnectionId === connectionId) {
        setActiveConnectionId(null);
        setActivePartner(null);
      }
      setActiveConnections(prev => prev.filter(c => c.id !== connectionId));
      socket.emit('block-user', { connectionId, userId });
      showToast('User has been blocked.', 'warning');
    } 
    else if (action === 'report') {
      if (activeConnectionId === connectionId) {
        setActiveConnectionId(null);
        setActivePartner(null);
      }
      setActiveConnections(prev => prev.filter(c => c.id !== connectionId));
      
      const conn = activeConnections.find(c => c.id === connectionId);
      const targetUserId = conn?.partnerId;
      if (targetUserId) {
        socket.emit('report-user', { connectionId, reporterId: userId, targetUserId });
      }
      showToast('User reported. Connection terminated.', 'error');
    }
    
    setActiveSafetyOptionsConnId(null);
  };

  // Admin login passcode submit
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !adminPasscode.trim()) return;
    socket.emit('admin-login', { passcode: adminPasscode.trim() });
  };

  // Admin manually ban a user
  const handleAdminBan = (targetUserId: string) => {
    if (!socket) return;
    if (window.confirm('Are you sure you want to ban this user? They will be immediately disconnected and blocked.')) {
      socket.emit('admin-ban-user', { targetUserId });
    }
  };

  // Admin dismiss user reports
  const handleAdminDismiss = (targetUserId: string) => {
    if (!socket) return;
    socket.emit('admin-dismiss-reports', { targetUserId });
  };

  // Admin unban a user
  const handleAdminUnban = (targetUserId: string) => {
    if (!socket) return;
    socket.emit('admin-unban-user', { targetUserId });
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 min-h-screen">
      
      {/* Background Neon Gradients */}
      <div className="absolute top-[10%] left-[20%] w-[350px] h-[350px] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[10%] right-[20%] w-[350px] h-[350px] rounded-full bg-cyan-900/10 blur-[120px] pointer-events-none"></div>

      {/* Mobile Top Header */}
      <header className="mobile-header">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Ghost className="w-4 h-4 text-white" />
          </div>
          <span className="font-space font-bold text-white text-sm">InstantMeet</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={syncRealLocation}
            className={`mobile-gps-pill ${locationSynced ? 'synced' : 'syncing'}`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{currentLocation ? formatCoords(currentLocation) : 'Syncing GPS...'}</span>
          </button>

          <div 
            onClick={() => { setActiveTab('settings'); setActiveConnectionId(null); }}
            className="w-8 h-8 rounded-full border border-white/10 overflow-hidden bg-white/5 flex items-center justify-center cursor-pointer"
            title="Profile Settings"
          >
            <img src={avatarUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${alias}`} alt="Avatar" className="w-full h-full object-cover" />
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav">
        <button 
          onClick={() => { setActiveTab('home'); setActiveConnectionId(null); }}
          className={`mobile-nav-btn ${activeTab === 'home' && !activeConnectionId ? 'active' : ''}`}
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </button>
        <button 
          onClick={() => { setActiveTab('connections'); setActiveConnectionId(null); }}
          className={`mobile-nav-btn ${activeTab === 'connections' ? 'active' : ''}`}
        >
          <Sparkles className="w-5 h-5" />
          <span>Discoveries</span>
        </button>
        <button 
          onClick={() => { setActiveTab('chats'); setActiveConnectionId(null); }}
          className={`mobile-nav-btn ${activeTab === 'chats' ? 'active' : ''}`}
        >
          <MessageCircle className="w-5 h-5" />
          <span>Chats</span>
        </button>
        <button 
          onClick={() => { setActiveTab('settings'); setActiveConnectionId(null); }}
          className={`mobile-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
        >
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </button>
        {isAdmin && (
          <button 
            onClick={() => { setActiveTab('admin' as any); setActiveConnectionId(null); }}
            className={`mobile-nav-btn ${activeTab === 'admin' ? 'active' : ''}`}
            style={{ color: '#f87171' }}
          >
            <ShieldAlert className="w-5 h-5" />
            <span>Admin</span>
          </button>
        )}
      </nav>

      {/* Main Masterpiece 3-Column Grid Layout */}
      <div className="dashboard-container">
           {/* ================= COLUMN 1: LEFT SIDEBAR ================= */}
        <aside className="sidebar-left">
          <div className="logo-section flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Ghost className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-gradient" style={{ fontSize: '1.25rem' }}>InstantMeet</h2>
              <p className="text-[11px] text-text-muted font-medium mt-0.5">Anonymous. Real. Nearby.</p>
            </div>
          </div>

          <nav className="nav-links">
            <button 
              onClick={() => { setActiveTab('home'); setActiveConnectionId(null); }}
              className={`nav-btn ${activeTab === 'home' && !activeConnectionId ? 'active' : ''}`}
            >
              <Home className="w-5 h-5" />
              Home
            </button>
            <button 
              onClick={() => { setActiveTab('connections'); setActiveConnectionId(null); }}
              className={`nav-btn ${activeTab === 'connections' ? 'active' : ''}`}
            >
              <MessageCircle className="w-5 h-5" />
              Connections
            </button>
            <button 
              onClick={() => { setActiveTab('chats'); setActiveConnectionId(null); }}
              className={`nav-btn ${activeTab === 'chats' ? 'active' : ''}`}
            >
              <MessageCircle className="w-5 h-5" />
              Chats
            </button>
            <button 
              onClick={() => { setActiveTab('settings'); setActiveConnectionId(null); }}
              className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
            >
              <Settings className="w-5 h-5" />
              Settings
            </button>
            {isAdmin && (
              <button 
                onClick={() => { setActiveTab('admin' as any); setActiveConnectionId(null); }}
                className={`nav-btn ${activeTab === 'admin' ? 'active' : ''}`}
                style={{ borderColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}
              >
                <ShieldAlert className="w-5 h-5" />
                Admin Console
              </button>
            )}
          </nav>

          {/* Anonymous Info Card */}
          <div className="glass-panel p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                <Ghost className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-white leading-tight">You are anonymous</h4>
                <p className="text-[10px] text-text-muted mt-0.5">Your identity stays hidden until you both choose to reveal.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowPrivacyModal(true)}
              className="text-[11px] text-violet-400 font-semibold hover:underline flex items-center gap-0.5 bg-transparent border-none p-0 cursor-pointer text-left"
              style={{ paddingLeft: '48px', width: 'fit-content' }}
            >
              Learn more <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Location status Card */}
          <div className="glass-panel p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-text-secondary mt-0.5" />
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">Your Location</span>
                <p className="text-sm font-bold text-white mt-0.5">
                  {currentLocation ? formatCoords(currentLocation) : 'Syncing GPS...'}
                </p>
                <p className={`text-[10px] font-medium mt-0.5 ${locationSynced ? 'text-violet-400' : 'text-amber-400 animate-pulse'}`}>
                  {locationSynced ? `Within ${discoveryRadius} km radius` : 'Syncing GPS...'}
                </p>
              </div>
            </div>
            
            <button 
              onClick={syncRealLocation}
              className="change-location-btn"
            >
              <span>Refresh Location</span>
              <Target className="w-4 h-4 text-text-secondary" />
            </button>
          </div>

          {/* Footer Copyright */}
          <div className="mt-auto pt-4 text-[10px] text-text-muted" style={{ paddingLeft: '12px' }}>
            © {new Date().getFullYear()} InstantMeet
          </div>
        </aside>

        {/* ================= COLUMN 2: CENTER WORKSPACE ================= */}
        <section className="flex-1 flex flex-col gap-6">
          
          {/* A. Onboarding / Profile Bar at the Top */}
          {!isRegistered && (
            <div className="glass-panel profile-onboarding-bar">
              <div className="profile-onboarding-header">
                <h3 className="profile-onboarding-title">
                  Complete your anonymous profile <Sparkles className="w-5 h-5 text-violet-400 inline-block align-middle ml-1.5" />
                </h3>
                <p className="profile-onboarding-subtitle">This is what others will see</p>
              </div>

              <div className="profile-onboarding-body">
                <div className="profile-inputs-row">
                  <div className="bar-input-group">
                    <label>Display Name</label>
                    <input 
                      type="text" 
                      value={alias}
                      onChange={(e) => setAlias(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                      placeholder="NightOwl"
                      className="bar-input display-name-input"
                    />
                  </div>

                  <div className="bar-input-group">
                    <label>
                      <Calendar className="w-4 h-4 text-violet-400" />
                      <span>Age</span>
                    </label>
                    <input 
                      type="number" 
                      value={age}
                      placeholder="22"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setAge('' as any);
                        } else {
                          const num = parseInt(val);
                          if (!isNaN(num)) {
                            setAge(num);
                          }
                        }
                      }}
                      onBlur={() => {
                        if (typeof age !== 'number' || isNaN(age)) {
                          setAge(18);
                        } else {
                          setAge(Math.max(13, Math.min(120, age)));
                        }
                      }}
                      className="bar-input age-input"
                    />
                  </div>

                  <div className="bar-input-group">
                    <label>
                      <MapPin className="w-4 h-4 text-violet-400" />
                      <span>Location</span>
                    </label>
                    <button 
                      type="button"
                      onClick={syncRealLocation}
                      className="bar-input location-sync-btn"
                      title="Click to sync accurate GPS location"
                    >
                      <span className="truncate" style={{ maxWidth: '110px' }}>
                        {currentLocation ? `${currentLocation.lat.toFixed(4)}°, ${currentLocation.lng.toFixed(4)}°` : 'Syncing GPS...'}
                      </span>
                      <Loader2 className={`w-3.5 h-3.5 flex-shrink-0 text-violet-400 ${!locationSynced ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  <div className="bar-input-group flex-1 interests-input-group">
                    <label>
                      <Heart className="w-4 h-4 text-violet-400" />
                      <span>Interests</span>
                    </label>
                    <div className="vibe-tags-container">
                      {selectedTags.map((tag) => {
                        const tagConfig = getTagConfig(tag);
                        return (
                          <span 
                            key={tag}
                            onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))}
                            className="vibe-tag"
                            title="Click to remove tag"
                            style={{
                              color: tagConfig.color,
                              backgroundColor: tagConfig.bgColor,
                              borderColor: tagConfig.borderColor
                            }}
                          >
                            {tagConfig.icon}
                            <span>{tag}</span>
                          </span>
                        );
                      })}
                      
                      {isAddingTag ? (
                        <input 
                          type="text" 
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          placeholder="Tag..."
                          className="vibe-tag-input-field"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddTag();
                              setIsAddingTag(false);
                            } else if (e.key === 'Escape') {
                              setNewTagInput('');
                              setIsAddingTag(false);
                            }
                          }}
                          onBlur={() => {
                            handleAddTag();
                            setIsAddingTag(false);
                          }}
                          autoFocus
                        />
                      ) : (
                        <button 
                          onClick={() => setIsAddingTag(true)}
                          className="vibe-tag-add-btn"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="onboarding-action-group">
                    <button 
                      onClick={() => handleRegisterOrEnter()}
                      className="btn-primary onboarding-gradient-btn"
                    >
                      <span>Enter Discovery Bubble</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* B. Centerpiece View (Radar Orb OR Active Chat Room) */}
          <div className="glass-panel flex-1 flex flex-col justify-center items-center min-h-[420px] p-6 relative">
            
            {errorMsg && (
              <div className="absolute top-4 left-4 right-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                <span>{errorMsg}</span>
              </div>
            )}

            {!activeConnectionId ? (
              activeTab === 'home' ? (
                /* Saturn Radar Orb Centerpiece */
                <div className="orb-discovery-centerpiece w-full">
                  <div className="planet-orb-container glow-primary">
                    {isScanning && <div className="orb-sweep-beam"></div>}
                    <div className="planet-ring"></div>
                    
                    {/* Glowing core sphere */}
                    <div className="planet-orb">
                      <span className="text-4xl font-extrabold font-space">
                        {isScanning ? <Loader2 className="w-8 h-8 animate-spin" /> : nearbyUsers.length}
                      </span>
                      <span className="text-[11px] uppercase tracking-wider text-violet-300 font-semibold mt-1">people nearby</span>
                      <span className="text-[9px] text-text-secondary mt-0.5">within {discoveryRadius} km</span>
                    </div>

                    {/* Real-time matched users positioned around the orb ring */}
                    {!isScanning && nearbyUsers.map((nu, i) => {
                      const angle = (i * 360) / Math.max(nearbyUsers.length, 1) - 30;
                      const radian = (angle * Math.PI) / 180;
                      const radius = 125; // radius offset
                      const x = Math.cos(radian) * radius;
                      const y = Math.sin(radian) * radius;

                      return (
                        <button
                          key={nu.userId}
                          onClick={() => setSelectedNode(nu)}
                          style={{ transform: `translate(${x}px, ${y}px)` }}
                          className={`radar-node-on-orb ${selectedNode?.userId === nu.userId ? 'scale-125 border-cyan-400 border-2' : ''}`}
                          title={`@${nu.alias}`}
                        >
                          <Users className="w-3.5 h-3.5 text-white" />
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col items-center gap-4">
                    {selectedNode ? (
                      <div className="glass-panel p-4 flex flex-col items-center text-center max-w-xs border-cyan-500/20">
                        <h4 className="font-bold text-white">@{selectedNode.alias}</h4>
                        <p className="text-xs text-cyan-400 font-semibold mt-0.5">
                          {selectedNode.distanceKm} km away{selectedNode.age > 0 ? ` • ${selectedNode.age}y/o` : ''}
                        </p>
                        <div className="flex flex-wrap gap-1 justify-center mt-2">
                          {selectedNode.interests.length > 0 ? (
                            selectedNode.interests.slice(0, 3).map(tag => (
                              <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-violet-300">
                                #{tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] px-2.5 py-1 rounded-full bg-violet-950/20 border border-violet-900/30 text-violet-400 font-medium italic">
                              Stealth Mode Active 🔒
                            </span>
                          )}
                        </div>

                        <button 
                          onClick={handleSendWave}
                          className="btn-primary py-2 px-6 mt-4 text-xs"
                        >
                          Connect Anonymous Chat
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleSearch}
                        disabled={isScanning || !isRegistered}
                        className="btn-primary"
                      >
                        {isScanning ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Searching...
                          </>
                        ) : (
                          <>
                            <Radar className="w-5 h-5 animate-pulse" />
                            Search Nearby People
                          </>
                        )}
                      </button>
                    )}
                    
                    <span className="text-[10px] text-text-muted flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-text-muted" /> We never share your exact location
                    </span>
                  </div>
                </div>
              ) : activeTab === 'connections' ? (
                /* Connections Tab Centerpiece */
                <div className="w-full flex flex-col p-4 md:p-6 text-left">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-xl font-bold font-space text-white">Mutually Revealed Discoveries</h3>
                      <p className="text-xs text-text-secondary mt-1">Connections that chose to unlock identity sharing.</p>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold">
                      {activeConnections.filter(c => c.isRevealed).length} Profiles Unlocked
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 overflow-y-auto max-h-[380px] pr-2">
                    {activeConnections.filter(c => c.isRevealed).length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 text-center bg-white/5 border border-white/10 rounded-2xl w-full">
                        <Sparkles className="w-8 h-8 text-violet-400 mb-2 animate-pulse" />
                        <h4 className="font-bold text-white text-sm">No Revealed Discoveries Yet</h4>
                        <p className="text-xs text-text-secondary mt-1 max-w-xs text-center">
                          Discoveries will unlock here once both you and your chat partner select 'Reveal Me'.
                        </p>
                      </div>
                    ) : (
                      activeConnections.filter(c => c.isRevealed).map(c => (
                        <div key={c.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between hover:border-violet-500/20 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full border border-violet-500/20 overflow-hidden bg-violet-500/5 flex items-center justify-center">
                              <img src={c.avatarUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${c.partnerAlias}`} alt="Avatar" className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <h4 className="font-bold text-white text-sm">
                                {c.realName} <span className="text-xs text-text-secondary font-medium font-mono">@{c.partnerAlias}</span>
                              </h4>
                              <p className="text-xs text-violet-400 font-medium">Unlocked • Active connection</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleRecentCardClick(c)}
                              className="px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-semibold hover:bg-violet-500 transition-all shadow-md shadow-violet-600/10"
                            >
                              Chat Again
                            </button>
                            <button 
                              onClick={() => { setActiveSafetyOptionsConnId(c.id); setSafetyPartnerAlias(c.partnerAlias); }}
                              className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center"
                              title="Safety Options"
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : activeTab === 'chats' ? (
                /* Chats Tab Centerpiece */
                <div className="w-full flex flex-col p-4 md:p-6 text-left">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-xl font-bold font-space text-white">Active Secure Threads</h3>
                      <p className="text-xs text-text-secondary mt-1">Chat securely and request mutual reveal whenever you are ready.</p>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                      {activeConnections.filter(c => c.isOnline).length} Active
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 overflow-y-auto max-h-[380px] pr-2">
                    {activeConnections.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 text-center bg-white/5 border border-white/10 rounded-2xl w-full">
                        <MessageSquare className="w-8 h-8 text-violet-400 mb-2 animate-pulse" />
                        <h4 className="font-bold text-white text-sm">No Active Chats</h4>
                        <p className="text-xs text-text-secondary mt-1 max-w-xs text-center">
                          Find nearby users on your Home discovery radar and click "Connect" to open a secure chat thread!
                        </p>
                      </div>
                    ) : (
                      activeConnections.map(c => (
                        <div key={c.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between hover:border-violet-500/20 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full border border-violet-500/20 overflow-hidden bg-white/5 flex items-center justify-center relative">
                              <img 
                                src={c.isRevealed && c.avatarUrl ? c.avatarUrl : `https://api.dicebear.com/7.x/bottts/svg?seed=${c.partnerAlias}`} 
                                alt="Avatar" 
                                className="w-full h-full object-cover" 
                              />
                              {c.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-bg-primary"></div>}
                            </div>
                            <div>
                              <h4 className="font-bold text-white text-sm">
                                {c.isRevealed && c.realName ? c.realName : `@${c.partnerAlias}`}
                              </h4>
                              <p className="text-xs text-text-secondary mt-0.5">
                                {c.isRevealed ? 'Identity Unlocked' : 'Anonymous Mode'} • {c.time}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleRecentCardClick(c)}
                              className="px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-semibold hover:bg-violet-500 transition-all shadow-md shadow-violet-600/10"
                            >
                              Resume Chat
                            </button>
                            <button 
                              onClick={() => { setActiveSafetyOptionsConnId(c.id); setSafetyPartnerAlias(c.partnerAlias); }}
                              className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center"
                              title="Safety Options"
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : activeTab === 'admin' ? (
                /* Admin Console Centerpiece */
                <div className="w-full flex flex-col p-4 md:p-6 text-left">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-xl font-bold font-space text-white">Admin Moderation Console</h3>
                      <p className="text-xs text-text-secondary mt-1">Monitor server activity and review safety flag reports.</p>
                    </div>
                  </div>

                  {/* Admin Stats Metrics Row */}
                  <div className="grid grid-cols-2 gap-4 mb-6" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', width: '100%' }}>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">Active Bubbles</span>
                      <p className="text-2xl font-extrabold text-violet-400 mt-1">{adminStats.activeUsersCount}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">Secure Chats</span>
                      <p className="text-2xl font-extrabold text-cyan-400 mt-1">{adminStats.activeConnectionsCount}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-6">
                    {/* Reported Users Table */}
                    <div className="flex flex-col gap-3">
                      <h4 className="text-xs uppercase font-bold tracking-wider text-text-muted">Active Community Reports</h4>
                      <div className="flex flex-col gap-3 overflow-y-auto max-h-[220px] pr-2">
                        {adminStats.reports.length === 0 ? (
                          <div className="p-5 text-center bg-white/5 border border-white/10 rounded-2xl text-xs text-emerald-400 font-medium">
                            ✅ No user flags reported. Community is safe!
                          </div>
                        ) : (
                          adminStats.reports.map(rep => (
                            <div key={rep.userId} className="p-3.5 rounded-xl bg-red-500/5 border border-red-500/10 flex items-center justify-between text-xs">
                              <div>
                                <h5 className="font-bold text-white">@{rep.alias} <span className="text-[10px] text-text-muted font-mono">({rep.userId})</span></h5>
                                <p className="text-[10px] text-red-400 font-bold mt-1">⚠️ {rep.reports} Flag(s) • Age: {rep.age}</p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAdminDismiss(rep.userId)}
                                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 font-semibold text-[10px] text-white"
                                >
                                  Dismiss
                                </button>
                                <button
                                  onClick={() => handleAdminBan(rep.userId)}
                                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 font-bold text-white text-[10px]"
                                >
                                  Ban User
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Banned Users List */}
                    <div className="flex flex-col gap-3">
                      <h4 className="text-xs uppercase font-bold tracking-wider text-text-muted">Banned Session List ({adminStats.banned.length})</h4>
                      <div className="flex flex-wrap gap-2 overflow-y-auto max-h-[100px] pr-2">
                        {adminStats.banned.length === 0 ? (
                          <p className="text-[10px] text-text-muted italic">No banned users in active memory.</p>
                        ) : (
                          adminStats.banned.map(banId => (
                            <div key={banId} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2 text-[10px] font-mono text-text-secondary">
                              <span>{banId}</span>
                              <button
                                onClick={() => handleAdminUnban(banId)}
                                className="text-violet-400 hover:underline font-bold"
                              >
                                Unban
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Settings Tab Centerpiece */
                <div className="w-full flex flex-col p-4 md:p-6 text-left">
                  <div className="flex items-center gap-3 mb-6">
                    <button 
                      onClick={() => setActiveTab(previousTab)}
                      className="p-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all flex items-center justify-center md:hidden"
                      title="Back"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h3 className="text-xl font-bold font-space text-white mb-1">Discovery & Privacy Settings</h3>
                      <p className="text-xs text-text-secondary">Manage how you appear and discover matches in your area.</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-white">Discovery Radius</span>
                        <span className="text-xs font-semibold text-violet-400">{discoveryRadius} km</span>
                      </div>
                      <input type="range" min="1" max="50" value={discoveryRadius} onChange={(e) => setDiscoveryRadius(parseInt(e.target.value))} className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-500" />
                      <div className="flex justify-between text-[10px] text-text-muted">
                        <span>1 km</span>
                        <span>10 km (Recommended)</span>
                        <span>50 km</span>
                      </div>
                    </div>

                    <hr className="border-white/5" />

                    <div className="flex flex-col gap-4">
                      <span className="text-xs uppercase font-bold tracking-wider text-text-muted">Profile Details</span>
                      
                      <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">Display Name (Alias)</label>
                          <input 
                            type="text" 
                            value={alias}
                            onChange={(e) => setAlias(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                            placeholder="Alias name"
                            className="bar-input w-full"
                            style={{ background: 'rgba(30, 20, 74, 0.4)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '10px 14px', color: '#fff', fontSize: '0.9rem' }}
                          />
                        </div>

                        <div className="w-24 flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">Age</label>
                          <input 
                            type="number" 
                            value={age}
                            placeholder="22"
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                setAge('' as any);
                              } else {
                                const num = parseInt(val);
                                if (!isNaN(num)) {
                                  setAge(num);
                                }
                              }
                            }}
                            onBlur={() => {
                              if (typeof age !== 'number' || isNaN(age)) {
                                  setAge(18);
                              } else {
                                  setAge(Math.max(13, Math.min(120, age)));
                              }
                            }}
                            className="bar-input w-full"
                            style={{ background: 'rgba(30, 20, 74, 0.4)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '10px 14px', color: '#fff', fontSize: '0.9rem' }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary">Real Name (Secret)</label>
                        <input 
                          type="text" 
                          value={realName}
                          onChange={(e) => setRealName(e.target.value)}
                          placeholder="Real name (secret)"
                          className="bar-input w-full"
                          style={{ background: 'rgba(30, 20, 74, 0.4)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '10px 14px', color: '#fff', fontSize: '0.9rem' }}
                        />
                        <p className="text-[10px] text-text-muted">This is only shown to your chat partner when both of you click "Reveal Me".</p>
                      </div>
                    </div>

                    <hr className="border-white/5" />

                    <div className="flex flex-col gap-4">
                      <span className="text-xs uppercase font-bold tracking-wider text-text-muted">Privacy Filters</span>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="text-sm font-bold text-white">Visible on Radar</h5>
                          <p className="text-[11px] text-text-secondary mt-0.5">Allow other nearby users to discover your bubble.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={visibleOnRadar} onChange={(e) => setVisibleOnRadar(e.target.checked)} className="sr-only peer" />
                          <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <div>
                          <h5 className="text-sm font-bold text-white">Stealth Mode</h5>
                          <p className="text-[11px] text-text-secondary mt-0.5">Conceal profile metadata unless wave is accepted.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={stealthMode} onChange={(e) => setStealthMode(e.target.checked)} className="sr-only peer" />
                          <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
                        </label>
                      </div>
                    </div>

                    <hr className="border-white/5" />

                    <button 
                      onClick={() => {
                        if (!alias.trim()) {
                          showToast('Display Name cannot be empty.', 'warning');
                          return;
                        }
                        if (typeof age !== 'number' || isNaN(age)) {
                          showToast('Please enter a valid Age.', 'warning');
                          return;
                        }
                        if (socket && isRegistered) {
                          const finalAge = typeof age !== 'number' || isNaN(age) ? 18 : Math.max(13, Math.min(120, age));
                          setAge(finalAge);
                          const generatedAvatar = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${alias}`;
                          socket.emit('register-user', {
                            userId,
                            alias,
                            realName: realName.trim() || alias.trim(),
                            avatarUrl: generatedAvatar,
                            interests: selectedTags,
                            age: finalAge,
                            location: currentLocation,
                            isVisible: visibleOnRadar,
                            stealthMode,
                          });
                        }
                        showToast('Discovery settings saved successfully!', 'success');
                      }}
                      className="btn-primary py-2.5 w-full text-xs"
                    >
                      Save Preferences
                    </button>

                    {!isAdmin && (
                      <>
                        <hr className="border-white/5" />
                        <form onSubmit={handleAdminLogin} className="flex flex-col gap-3">
                          <span className="text-xs uppercase font-bold tracking-wider text-text-muted">Admin Portal</span>
                          <div className="flex gap-2">
                            <input 
                              type="password" 
                              value={adminPasscode}
                              onChange={(e) => setAdminPasscode(e.target.value)}
                              placeholder="Enter admin passcode"
                              className="bar-input flex-1"
                              style={{ background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '12px', padding: '10px 14px', color: '#fff', fontSize: '0.85rem' }}
                            />
                            <button 
                              type="submit"
                              className="px-4 py-2 bg-red-950/20 border border-red-900/30 text-red-400 rounded-xl text-xs font-semibold hover:bg-red-900/20 transition-all"
                            >
                              Unlock Console
                            </button>
                          </div>
                        </form>
                      </>
                    )}
                  </div>
                </div>
              )
            ) : (
              /* Real-time Glassmorphic Chat Panel */
              <div className="centerpiece-chat-panel">
                {showParticleEffect && <div className="reveal-overlay"></div>}

                {/* Chat Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden relative bg-white/5">
                      <img 
                        src={revealedProfiles ? (revealedProfiles.user1.id === userId ? revealedProfiles.user2.avatarUrl : revealedProfiles.user1.avatarUrl) : `https://api.dicebear.com/7.x/bottts/svg?seed=${activePartner?.alias}`} 
                        alt="Avatar" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">
                        {revealedProfiles ? (revealedProfiles.user1.id === userId ? revealedProfiles.user2.realName : revealedProfiles.user1.realName) : `@${activePartner?.alias}`}
                      </h4>
                      <span className="text-[10px] text-text-secondary flex items-center gap-1">
                        {revealedProfiles ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> Identity Revealed</span>
                        ) : (
                          <span className="text-amber-400 flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> Anonymous Mode</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => { setActiveConnectionId(null); setActivePartner(null); }}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-white hover:bg-white/10 transition-all"
                    >
                      Exit Room
                    </button>
                    <button
                      onClick={() => {
                        if (activeConnectionId && activePartner) {
                          setActiveSafetyOptionsConnId(activeConnectionId);
                          setSafetyPartnerAlias(activePartner.alias);
                        }
                      }}
                      className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                      title="Safety Options"
                    >
                      <ShieldAlert className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Chat History Panel */}
                <div className="flex-1 p-4 overflow-y-auto flex flex-col min-h-[300px]">
                  {chatMessages.map((msg) => {
                    const isMe = msg.senderId === userId;
                    return (
                      <div
                        key={msg.id}
                        className={`message-bubble ${isMe ? 'message-sent' : 'message-received'}`}
                      >
                        <div className="text-[9px] opacity-60 mb-0.5 font-semibold">
                          {isMe ? 'You' : msg.senderAlias}
                        </div>
                        <div>{sanitizeText(msg.text)}</div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reveal Request Area */}
                {!revealedProfiles && (
                  <div className="p-3 border-t border-white/10 bg-white/5 flex items-center justify-between gap-2">
                    <div className="text-xs text-text-secondary">
                      {partnerRevealPending ? '⚠️ Partner wants to reveal profile!' : 'Reveal profile to this person?'}
                    </div>
                    
                    <button
                      onClick={handleRequestReveal}
                      disabled={revealRequested}
                      className={`text-xs px-3 py-2 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                        revealRequested 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-violet-600 text-white hover:bg-violet-500 shadow-sm'
                      }`}
                    >
                      {revealRequested ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Waiting...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Reveal Me
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Input Form */}
                <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 flex gap-2">
                  <input
                    type="text"
                    value={typedMessage}
                    onChange={(e) => setTypedMessage(e.target.value)}
                    placeholder="Type secure message..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 transition-all text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!typedMessage.trim()}
                    className="p-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 transition-all flex items-center justify-center shadow-md shadow-violet-600/20"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* C. Recent Connections bottom deck */}
          <div className="recent-connections-section">
            <div className="deck-header">
              <h4>Recent Connections</h4>
              <button onClick={() => showToast('Connection history is available in the Chats tab.', 'info')} className="text-xs text-violet-400 font-semibold hover:underline">View all</button>
            </div>
            
            <div className="deck-cards">
              {activeConnections.length === 0 ? (
                <div className="p-5 text-center bg-white/5 border border-white/10 rounded-2xl w-full text-xs text-text-secondary">
                  No active connections yet. Search nearby and wave to open a thread!
                </div>
              ) : (
                activeConnections.map((c) => (
                  <div 
                    key={c.id}
                    onClick={() => handleRecentCardClick(c)}
                    className="glass-panel glass-card connection-card relative group cursor-pointer"
                  >
                    {/* Hover-revealed safety button */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSafetyOptionsConnId(c.id);
                        setSafetyPartnerAlias(c.partnerAlias);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all z-10"
                      title="Safety Options"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                    </button>

                    <div className="connection-card-avatar border-violet-500/20">
                      <img 
                        src={c.isRevealed && c.avatarUrl ? c.avatarUrl : `https://api.dicebear.com/7.x/bottts/svg?seed=${c.partnerAlias}`} 
                        alt="Avatar" 
                      />
                      {c.isOnline && <div className="active-dot"></div>}
                    </div>
                    <h5>{c.isRevealed && c.realName ? c.realName : `@${c.partnerAlias}`}</h5>
                    <p className="text-[10px] text-text-muted mt-0.5">{c.time}</p>
                  </div>
                ))
              )}
            </div>
          </div>

        </section>

        {/* ================= COLUMN 3: RIGHT SIDEBAR ================= */}
        <aside className="sidebar-right">
          <div className="right-header">
            {/* Server status dot */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-semibold">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`}></div>
              <span className="text-text-secondary">{isConnected ? 'Server Live' : 'Connecting'}</span>
            </div>

            <button className="bell-btn" onClick={() => showToast('No new notifications.', 'info')}>
              <Bell className="w-5 h-5" />
            </button>
            
            {/* User Info dropdown slot */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setActiveTab('settings'); setActiveConnectionId(null); }} title="Click to view and edit profile settings">
              <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden bg-white/5 relative flex items-center justify-center">
                <img src={avatarUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${alias}`} alt="Avatar" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>

          {/* How it works TIMELINE widget */}
          <div className="glass-panel timeline-box">
            <h4>How it works</h4>
            
            <div className="timeline-step">
              <div className="timeline-icon">
                <Users className="w-4 h-4" />
              </div>
              <div className="timeline-content">
                <h5>Create your profile</h5>
                <p>Add a name, age and interests.</p>
              </div>
            </div>

            <div className="timeline-step">
              <div className="timeline-icon">
                <Compass className="w-4 h-4 animate-spin-slow" />
              </div>
              <div className="timeline-content">
                <h5>Enter the bubble</h5>
                <p>We search for people near you (up to 50 km).</p>
              </div>
            </div>

            <div className="timeline-step">
              <div className="timeline-icon">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div className="timeline-content">
                <h5>Get matched 1-to-1</h5>
                <p>We show one person at a time.</p>
              </div>
            </div>

            <div className="timeline-step">
              <div className="timeline-icon">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="timeline-content">
                <h5>Chat anonymously</h5>
                <p>Talk, connect and decide if you want to reveal.</p>
              </div>
            </div>
          </div>



          {/* Premium promo widget */}
          <div className="upgrade-promo-card">
            <h5>Want better matches?</h5>
            <p>Increase your chances by completing your profile details.</p>
            <button 
              onClick={() => showToast('Premium features coming soon! Stay tuned.', 'info')}
              className="btn-primary upgrade-btn"
            >
              Upgrade Now
            </button>
          </div>
        </aside>

      </div>

      {/* Incoming wave requests notification */}
      {incomingRequest && (
        <div className="modal-overlay">
          <div className="glass-panel modal-card border-cyan-500/20" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <div className="modal-header-icon" style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.2)', color: '#22d3ee' }}>
                <Compass className="w-5 h-5 animate-pulse" />
              </div>
              <div className="modal-header-info">
                <h4>Incoming Wave!</h4>
                <p>A nearby user wants to connect</p>
              </div>
            </div>

            <div className="modal-divider" />

            <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '20px' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'rgba(255,255,255,0.4)', margin: '0 0 6px 0' }}>@{incomingRequest.fromUserAlias}</p>
              <p style={{ fontSize: '0.85rem', color: '#fff', fontStyle: 'italic', margin: 0 }}>"{incomingRequest.message}"</p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setIncomingRequest(null)}
                style={{ flex: 1, padding: '11px 16px', borderRadius: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Decline
              </button>
              <button
                onClick={handleAcceptRequest}
                style={{ flex: 1, padding: '11px 16px', borderRadius: '12px', background: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)', border: 'none', color: '#000', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px 15px rgba(6, 182, 212, 0.3)', transition: 'all 0.25s' }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <MessageSquare className="w-4 h-4" />
                Chat Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy modal popup explanation */}
      {showPrivacyModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-header-icon">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="modal-header-info">
                <h4>Privacy & Anonymity</h4>
                <p>Your safety is our top priority</p>
              </div>
            </div>

            <div className="modal-divider" />

            <div className="modal-list">
              <div className="modal-list-item">
                <div className="modal-list-number">1</div>
                <div className="modal-list-content">
                  <h5>Masked Identity</h5>
                  <p>Your real name and avatar are completely hidden. Other users only see your pseudonym (Alias) and interests.</p>
                </div>
              </div>

              <div className="modal-list-item">
                <div className="modal-list-number">2</div>
                <div className="modal-list-content">
                  <h5>Hyperlocal Geofencing</h5>
                  <p>We check for active matches within your chosen radius (up to 50 km), but your exact GPS coordinates are never stored or shared with anyone.</p>
                </div>
              </div>

              <div className="modal-list-item">
                <div className="modal-list-number">3</div>
                <div className="modal-list-content">
                  <h5>Double-Opt-In Reveal</h5>
                  <p>In a chat, your identity remains locked until **both** you and your chat partner select "Reveal Me". It requires mutual consent.</p>
                </div>
              </div>

              <div className="modal-list-item">
                <div className="modal-list-number">4</div>
                <div className="modal-list-content">
                  <h5>Instant Blocking</h5>
                  <p>You can block any user at any moment. Doing so immediately cuts the connection and erases the chat history permanently.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowPrivacyModal(false)}
              className="modal-close-btn"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      )}

      {/* Safety Options Modal */}
      {activeSafetyOptionsConnId && (
        <div className="modal-overlay">
          <div className="glass-panel modal-card border-red-500/20" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <div className="modal-header-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="modal-header-info">
                <h4>Safety Options</h4>
                <p>Manage connection with @{safetyPartnerAlias}</p>
              </div>
            </div>

            <div className="modal-divider" />

            <div className="flex flex-col gap-3 mb-6" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px', width: '100%' }}>
              <button
                onClick={() => handleSafetyAction('delete', activeSafetyOptionsConnId)}
                className="w-full p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-violet-500/20 text-left flex flex-col gap-1 text-white"
                style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '14px', borderRadius: '14px', width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span className="text-xs font-bold">🗑️ Delete Conversation</span>
                <span className="text-[10px] text-text-secondary font-normal" style={{ textTransform: 'none' }}>Erase chat history and remove this thread from your active list. Partner is not blocked.</span>
              </button>

              <button
                onClick={() => handleSafetyAction('block', activeSafetyOptionsConnId)}
                className="w-full p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-red-500/20 text-left flex flex-col gap-1 text-white"
                style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '14px', borderRadius: '14px', width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span className="text-xs font-bold text-red-400">🚫 Block User</span>
                <span className="text-[10px] text-text-secondary font-normal" style={{ textTransform: 'none' }}>Sever connection instantly, erase history, and prevent matching with them again.</span>
              </button>

              <button
                onClick={() => handleSafetyAction('report', activeSafetyOptionsConnId)}
                className="w-full p-3.5 rounded-xl bg-red-500/5 border border-red-500/10 hover:border-red-500/30 text-left flex flex-col gap-1 text-white"
                style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '14px', borderRadius: '14px', width: '100%', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)' }}
              >
                <span className="text-xs font-bold text-red-500">⚠️ Report User</span>
                <span className="text-[10px] text-text-secondary font-normal" style={{ textTransform: 'none' }}>Report inappropriate behavior. Blocks them immediately and flags them for community safety.</span>
              </button>
            </div>

            <button
              onClick={() => setActiveSafetyOptionsConnId(null)}
              className="modal-close-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification System */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
          >
            <span className="toast-text">{toast.text}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="toast-close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
