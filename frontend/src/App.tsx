// InstantMeet Frontend - Responsive Mobile Web App
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Users,
  Home,
  MessageCircle,
  Settings,
  Bell,
  ChevronRight,
  ShieldCheck,
  Ghost,
  Heart,
  Calendar,
  Camera,
  Music,
  Coffee,
  Tag,
  ArrowLeft,
  X,
  MoreVertical,
  Globe,
  Gamepad2,
  BellOff
} from 'lucide-react';
import './App.css';

// Production-safe WebSocket URL: uses env variable in production, fallback for dev
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

interface City {
  name: string;
  lat: number;
  lng: number;
}

const INDIAN_CITIES: City[] = [
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
  { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  { name: 'Pune', lat: 18.5204, lng: 73.8567 },
  { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
  { name: 'Lucknow', lat: 26.8467, lng: 80.9462 },
  { name: 'Chandigarh', lat: 30.7333, lng: 76.7794 },
  { name: 'Gurugram', lat: 28.4595, lng: 77.0266 },
  { name: 'Noida', lat: 28.5355, lng: 77.3910 },
  { name: 'Kochi', lat: 9.9312, lng: 76.2673 },
  { name: 'Thiruvananthapuram', lat: 8.5241, lng: 76.9366 },
  { name: 'Goa', lat: 15.4909, lng: 73.8278 },
  { name: 'Indore', lat: 22.7196, lng: 75.8577 },
  { name: 'Bhopal', lat: 23.2599, lng: 77.4126 },
  { name: 'Surat', lat: 21.1702, lng: 72.8311 },
  { name: 'Vadodara', lat: 22.3072, lng: 73.1812 },
  { name: 'Rajkot', lat: 22.3039, lng: 70.8022 },
  { name: 'Nagpur', lat: 21.1458, lng: 79.0882 },
  { name: 'Coimbatore', lat: 11.0168, lng: 76.9558 },
  { name: 'Madurai', lat: 9.9252, lng: 78.1198 },
  { name: 'Visakhapatnam', lat: 17.6868, lng: 83.2185 },
  { name: 'Vijayawada', lat: 16.5062, lng: 80.6480 },
  { name: 'Patna', lat: 25.5941, lng: 85.1376 },
  { name: 'Ranchi', lat: 23.3441, lng: 85.3096 },
  { name: 'Bhubaneswar', lat: 20.2961, lng: 85.8245 },
  { name: 'Guwahati', lat: 26.1445, lng: 91.7362 },
  { name: 'Raipur', lat: 21.2514, lng: 81.6296 },
  { name: 'Dehradun', lat: 30.3165, lng: 78.0322 },
  { name: 'Amritsar', lat: 31.6340, lng: 74.8723 },
  { name: 'Ludhiana', lat: 30.9010, lng: 75.8573 },
  { name: 'Jodhpur', lat: 26.2389, lng: 73.0243 },
  { name: 'Kota', lat: 25.1825, lng: 75.8369 },
  { name: 'Srinagar', lat: 34.0837, lng: 74.7973 },
  { name: 'Varanasi', lat: 25.3176, lng: 82.9739 },
  { name: 'Jamshedpur', lat: 22.8046, lng: 86.2029 }
];

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
  gender: string;
  distanceKm: number;
  isOnline: boolean;
  city?: string;
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

interface Drop {
  id: string;
  userId: string;
  type: 'voice' | 'message';
  contentUrl?: string;
  messageText?: string;
  duration?: number;
  city: string;
  location: { lat: number; lng: number };
  status: 'active' | 'accepted';
  createdAt: number;
}

interface Notification {
  id: string;
  type: 'wave' | 'message' | 'drop-request';
  fromUserId: string;
  fromUserAlias: string;
  fromUserAvatarUrl?: string;
  message: string;
  timestamp: Date;
  connectionId?: string;
  dropId?: string;
  requestId?: string;
  dropType?: 'voice' | 'message';
}

interface RadarBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  forbiddenRects: Array<{ xMin: number; xMax: number; yMin: number; yMax: number }>;
}

const seededRandom = (seedString: string) => {
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = seedString.charCodeAt(i) + ((hash << 5) - hash);
  }
  return () => {
    const x = Math.sin(hash++) * 10000;
    return x - Math.floor(x);
  };
};

const getDropPositions = (
  drops: Drop[],
  bounds: RadarBounds,
  matchedUsersCount: number
): Array<{ drop: Drop; x: number; y: number }> => {
  const placed: Array<{ x: number; y: number }> = [];
  
  // Calculate matched node coordinates relative to centerpiece to avoid them
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
  const matchedCoords: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < matchedUsersCount; i++) {
    const angle = (i * 360) / (matchedUsersCount || 1) - 30;
    const radian = (angle * Math.PI) / 180;
    const orbitIndex = i % 3;
    let baseRadius = 115;
    if (orbitIndex === 0) baseRadius = 95;
    if (orbitIndex === 2) baseRadius = 135;
    if (isMobile) {
      baseRadius = 90;
      if (orbitIndex === 0) baseRadius = 75;
      if (orbitIndex === 2) baseRadius = 105;
    }
    matchedCoords.push({
      x: Math.cos(radian) * baseRadius,
      y: Math.sin(radian) * baseRadius
    });
  }

  return drops.map((drop) => {
    const rand = seededRandom(drop.id);
    let bestX = 0;
    let bestY = -150;
    let placedSuccess = false;
    const minGap = 85; // 85px center-to-center is ~1cm clear gap

    // We do multiple passes with decreasing gap sizes if placement is difficult
    const gapMultiplierTiers = [1.0, 0.8, 0.6, 0.4];

    for (const tier of gapMultiplierTiers) {
      const currentGap = minGap * tier;
      for (let attempt = 0; attempt < 150; attempt++) {
        // Generate coordinates randomly distributed in xMin..xMax and yMin..yMax
        const rx = bounds.xMin + rand() * (bounds.xMax - bounds.xMin);
        const ry = bounds.yMin + rand() * (bounds.yMax - bounds.yMin);
        
        // 1. Avoid center Saturn orb and the orbit ring (exclude radius < 150px)
        const distFromCenter = Math.sqrt(rx * rx + ry * ry);
        if (distFromCenter < 150) continue;

        // 2. Avoid all forbidden rects (top corners, bottom buttons)
        const overlapsForbidden = bounds.forbiddenRects.some(
          (rect) => rx >= rect.xMin && rx <= rect.xMax && ry >= rect.yMin && ry <= rect.yMax
        );
        if (overlapsForbidden) continue;

        // 3. Avoid other placed drops
        const tooCloseToDrops = placed.some((other) => {
          const dx = rx - other.x;
          const dy = ry - other.y;
          return Math.sqrt(dx * dx + dy * dy) < currentGap;
        });
        if (tooCloseToDrops) continue;

        // 4. Avoid matched user nodes on orbits
        const tooCloseToMatched = matchedCoords.some((other) => {
          const dx = rx - other.x;
          const dy = ry - other.y;
          return Math.sqrt(dx * dx + dy * dy) < currentGap;
        });
        if (tooCloseToMatched) continue;

        // Found a safe spot!
        bestX = rx;
        bestY = ry;
        placedSuccess = true;
        break;
      }
      if (placedSuccess) break;
    }

    const pos = { x: bestX, y: bestY };
    placed.push(pos);
    return { drop, x: pos.x, y: pos.y };
  });
};

export default function App() {
  // Preemptively check if the last active session has expired (> 60 seconds)
  if (typeof window !== 'undefined') {
    const lastActive = localStorage.getItem('im_lastActiveTimestamp');
    if (lastActive) {
      const elapsed = Date.now() - parseInt(lastActive, 10);
      if (elapsed > 60000) {
        localStorage.removeItem('im_isRegistered');
        localStorage.removeItem('im_userId');
        localStorage.removeItem('im_alias');
        localStorage.removeItem('im_gender');
        localStorage.removeItem('im_genderPreference');
        localStorage.removeItem('im_age');
        localStorage.removeItem('im_avatarUrl');
        localStorage.removeItem('im_selectedTags');
        localStorage.removeItem('im_selectedCity');
        localStorage.removeItem('im_lastActiveTimestamp');
      }
    }
  }

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
  const [userId, setUserId] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('im_userId') || '';
    return '';
  });
  const [alias, setAlias] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('im_alias') || '';
    return '';
  });
  const [realName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('im_gender') as any) || 'male';
    return 'male';
  });
  const [genderPreference, setGenderPreference] = useState<'male' | 'female' | 'any'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('im_genderPreference') as any) || 'any';
    return 'any';
  });
  const [age, setAge] = useState<number | ''>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('im_age');
      return saved ? parseInt(saved, 10) : '';
    }
    return '';
  });
  const [avatarUrl, setAvatarUrl] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('im_avatarUrl') || '';
    return '';
  });
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('im_selectedTags');
      return saved ? JSON.parse(saved) : ['Photography', 'Music', 'Coffee'];
    }
    return ['Photography', 'Music', 'Coffee'];
  });
  const [isRegistered, setIsRegistered] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('im_isRegistered') === 'true';
    return false;
  });
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Discovery & Privacy Settings (wired to server)
  const [visibleOnRadar, setVisibleOnRadar] = useState(true);
  const [stealthMode, setStealthMode] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [activeInterestFilter, setActiveInterestFilter] = useState<string | null>(null);
  const [batchIndex, setBatchIndex] = useState(0);

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
  const [selectedCity, setSelectedCity] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('im_selectedCity') || '';
    return '';
  });

  // Discovery / Matching State
  const [isScanning, setIsScanning] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<SearchResult[]>([]);
  const [selectedNode, setSelectedNode] = useState<SearchResult | null>(null);
  const [isGlobalSearchActive, setIsGlobalSearchActive] = useState(false);
  const [showGlobalFallbackPrompt, setShowGlobalFallbackPrompt] = useState(false);

  // Multiplayer Game States
  const [activeGame, setActiveGame] = useState<'tictactoe' | 'drawguess' | null>(null);
  const [showGameSelector, setShowGameSelector] = useState(false);
  const [gameScores, setGameScores] = useState<{ [userId: string]: number }>({});
  
  // Tic Tac Toe States
  const [tttBoard, setTttBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [tttTurn, setTttTurn] = useState<string>(''); // userId
  const [tttWinner, setTttWinner] = useState<string | null>(null); // userId, 'draw', or null

  // Draw & Guess States
  const [dgDrawerId, setDgDrawerId] = useState<string>('');
  const [dgWord, setDgWord] = useState<string>(''); // secret word (only drawer sees)
  const [dgHint, setDgHint] = useState<string>(''); // hint (blank underscores)
  const [dgGuessInput, setDgGuessInput] = useState<string>('');
  const [dgCelebration, setDgCelebration] = useState<{ winnerAlias: string; word: string } | null>(null);
  const [dgIncorrectGuess, setDgIncorrectGuess] = useState<string>('');

  // Canvas drawing refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const prevCoordsRef = useRef<{ x: number; y: number } | null>(null);
  const [drawColor, setDrawColor] = useState<string>('#a855f7'); // default violet
  const [brushSize, setBrushSize] = useState<number>(3);

  // Chat / Connection State
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [activePartner, setActivePartner] = useState<{ id: string; alias: string; avatarUrl?: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [typedMessage, setTypedMessage] = useState('');

  useEffect(() => {
    setShowChatMenu(false);
  }, [activeConnectionId]);
  
  // Reveal / Safety State
  const [incomingRequest, setIncomingRequest] = useState<{
    connectionId: string;
    fromUserId: string;
    fromUserAlias: string;
    message: string;
  } | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const [showChatMenu, setShowChatMenu] = useState(false);

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
    cities?: { [city: string]: number };
  }>({
    activeUsersCount: 0,
    activeConnectionsCount: 0,
    reports: [],
    banned: [],
    cities: {},
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

  // Drop states
  const [activeDrops, setActiveDrops] = useState<Drop[]>([]);

  // Refs and state for dynamic radar bounds calculation
  const glassPanelRef = useRef<HTMLDivElement | null>(null);
  const orbContainerRef = useRef<HTMLDivElement | null>(null);
  const [radarBounds, setRadarBounds] = useState<RadarBounds>({
    xMin: -380,
    xMax: 380,
    yMin: -190,
    yMax: 190,
    forbiddenRects: []
  });

  // Dynamically calculate radar boundaries and avoid obstacles (top buttons, bottom controls)
  useEffect(() => {
    const updateBounds = () => {
      const panel = glassPanelRef.current;
      const orb = orbContainerRef.current;
      if (!panel || !orb) return;

      const panelRect = panel.getBoundingClientRect();
      const orbRect = orb.getBoundingClientRect();

      const centerX = orbRect.left + orbRect.width / 2;
      const centerY = orbRect.top + orbRect.height / 2;

      // Outer boundaries of glass panel relative to the center of the planet orb container
      // Adding safety margins so drops do not clip boundaries (each drop has 42px width/height)
      const xMin = panelRect.left - centerX + 30;
      const xMax = panelRect.right - centerX - 30;
      const yMin = panelRect.top - centerY + 30;
      const yMax = panelRect.bottom - centerY - 30;

      // Obstacles to avoid (top buttons, bottom controls)
      const forbiddenRects: Array<{ xMin: number; xMax: number; yMin: number; yMax: number }> = [];
      const elementIds = ['edit-profile-btn', 'toggle-mock-btn', 'bottom-controls-area'];
      
      elementIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            forbiddenRects.push({
              xMin: r.left - centerX - 25,
              xMax: r.right - centerX + 25,
              yMin: r.top - centerY - 25,
              yMax: r.bottom - centerY + 25
            });
          }
        }
      });

      setRadarBounds({ xMin, xMax, yMin, yMax, forbiddenRects });
    };

    updateBounds();

    // Use ResizeObserver to detect layout changes and recalculate bounds
    const panel = glassPanelRef.current;
    if (!panel) return;
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(updateBounds);
    });
    observer.observe(panel);

    // Also update on window resize as a secondary trigger
    window.addEventListener('resize', updateBounds);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateBounds);
    };
  }, [activeTab, activeConnectionId, isRegistered, nearbyUsers.length]);

  // Synchronize profile data to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('im_isRegistered', String(isRegistered));
      if (isRegistered) {
        localStorage.setItem('im_userId', userId);
        localStorage.setItem('im_alias', alias);
        localStorage.setItem('im_gender', gender);
        localStorage.setItem('im_genderPreference', genderPreference);
        localStorage.setItem('im_age', String(age));
        localStorage.setItem('im_avatarUrl', avatarUrl);
        localStorage.setItem('im_selectedTags', JSON.stringify(selectedTags));
        localStorage.setItem('im_selectedCity', selectedCity);
      }
    }
  }, [isRegistered, userId, alias, gender, genderPreference, age, avatarUrl, selectedTags, selectedCity]);

  const displayedDrops = activeDrops;

  const [requestedDropIds, setRequestedDropIds] = useState<Set<string>>(new Set());
  const [selectedDrop, setSelectedDrop] = useState<Drop | null>(null);
  const [isDropModalOpen, setIsDropModalOpen] = useState(false);
  const [dropType, setDropType] = useState<'voice' | 'message'>('voice');
  const [dropMessageText, setDropMessageText] = useState('');
  
  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // Audio playback state
  const [currentlyPlayingDropId, setCurrentlyPlayingDropId] = useState<string | null>(null);
  const [audioPlaybackProgress, setAudioPlaybackProgress] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const isGlobalSearchActiveRef = useRef(isGlobalSearchActive);
  useEffect(() => {
    isGlobalSearchActiveRef.current = isGlobalSearchActive;
  }, [isGlobalSearchActive]);

  useEffect(() => {
    if (selectedNode) {
      setSelectedDrop(null);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        setCurrentlyPlayingDropId(null);
        setAudioPlaybackProgress(0);
      }
    }
  }, [selectedNode]);

  useEffect(() => {
    if (selectedDrop) {
      setSelectedNode(null);
    }
  }, [selectedDrop]);

  // Keep ref to avoid stale closures in socket event handlers
  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const activeConnectionIdRef = useRef(activeConnectionId);
  useEffect(() => {
    activeConnectionIdRef.current = activeConnectionId;
  }, [activeConnectionId]);

  const activeConnectionsRef = useRef(activeConnections);
  useEffect(() => {
    activeConnectionsRef.current = activeConnections;
  }, [activeConnections]);

  // Reset chat messages when active connection changes
  useEffect(() => {
    setChatMessages([]);
  }, [activeConnectionId]);

  // Keep latest registration data in a ref to use during auto-reconnection
  const regDataRef = useRef({
    userId,
    alias,
    realName,
    avatarUrl,
    interests: selectedTags,
    age,
    gender,
    genderPreference,
    city: selectedCity,
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
      gender,
      genderPreference,
      city: selectedCity,
      location: currentLocation,
      isVisible: visibleOnRadar,
      stealthMode,
    };
  }, [userId, alias, realName, avatarUrl, selectedTags, age, gender, genderPreference, selectedCity, currentLocation, visibleOnRadar, stealthMode]);

  // Re-register automatically on reconnect (if user was already registered)
  useEffect(() => {
    if (isConnected && isRegistered && socket && currentLocation) {
      console.log('Socket reconnected, auto-registering user:', regDataRef.current.alias);
      socket.emit('register-user', regDataRef.current);
      socket.emit('get-active-drops', { userId: regDataRef.current.userId, global: isGlobalSearchActiveRef.current });
      
      // If we are currently in an active chat room, sync history to catch up on missed messages
      if (activeConnectionId) {
        socket.emit('get-chat-history', { connectionId: activeConnectionId });
      }
    }
  }, [isConnected, isRegistered, socket, activeConnectionId, currentLocation]);

  // Listen for visibility change or tab unload to save a timestamp
  useEffect(() => {
    const handleVisibilityOrUnload = () => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('im_lastActiveTimestamp', String(Date.now()));
      }
    };

    window.addEventListener('beforeunload', handleVisibilityOrUnload);
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleVisibilityOrUnload();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleVisibilityOrUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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
        setUserId('');
        setAlias('');
        setGender('male');
        setGenderPreference('any');
        setAge('');
        setAvatarUrl('');
        setSelectedTags(['Photography', 'Music', 'Coffee']);
        setSelectedCity('');
        setCurrentLocation(null);
        setLocationSynced(false);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('im_isRegistered');
          localStorage.removeItem('im_userId');
          localStorage.removeItem('im_alias');
          localStorage.removeItem('im_gender');
          localStorage.removeItem('im_genderPreference');
          localStorage.removeItem('im_age');
          localStorage.removeItem('im_avatarUrl');
          localStorage.removeItem('im_selectedTags');
          localStorage.removeItem('im_selectedCity');
          localStorage.removeItem('im_lastActiveTimestamp');
        }
      }
      setTimeout(() => setErrorMsg(null), 5000);
    });


    socketInstance.on('registration-success', (data: { userId: string; alias: string }) => {
      setUserId(data.userId);
      setIsRegistered(true);
      socketInstance.emit('get-active-drops', { userId: data.userId, global: isGlobalSearchActiveRef.current });
    });

    socketInstance.on('incoming-connection-request', (data: {
      connectionId: string;
      fromUserId: string;
      fromUserAlias: string;
      fromUserAvatarUrl?: string;
      message: string;
    }) => {
      const newNotif: Notification = {
        id: `wave-${data.connectionId}-${Date.now()}`,
        type: 'wave',
        fromUserId: data.fromUserId,
        fromUserAlias: data.fromUserAlias,
        fromUserAvatarUrl: data.fromUserAvatarUrl,
        message: data.message,
        timestamp: new Date(),
        connectionId: data.connectionId,
      };
      setNotifications((prev) => [newNotif, ...prev]);
      showToast(`New wave from @${data.fromUserAlias}! 👋`, 'info');
    });

    socketInstance.on('connection-accepted', (data: {
      connectionId: string;
      partnerAlias: string;
      partnerId: string;
      partnerAvatarUrl?: string;
    }) => {
      setActiveConnectionId(data.connectionId);
      setActivePartner({ id: data.partnerId, alias: data.partnerAlias, avatarUrl: data.partnerAvatarUrl });
      setChatMessages([]);
      setIncomingRequest(null);
      setNotifications((prev) => prev.filter((n) => n.connectionId !== data.connectionId));
      setShowNotifications(false);

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
            avatarUrl: data.partnerAvatarUrl,
            time: 'Just now',
          },
        ];
      });
    });

    socketInstance.on('chat-message', (msg: Message) => {
      setChatMessages((prev) => [...prev, msg]);

      if (activeConnectionIdRef.current !== msg.connectionId && msg.senderId !== userIdRef.current) {
        const conn = activeConnectionsRef.current.find((c) => c.id === msg.connectionId);
        const partnerAlias = conn ? conn.partnerAlias : 'Someone';

        const newNotif: Notification = {
          id: `msg-${msg.id}-${Date.now()}`,
          type: 'message',
          fromUserId: msg.senderId,
          fromUserAlias: partnerAlias,
          fromUserAvatarUrl: conn?.avatarUrl,
          message: msg.text,
          timestamp: new Date(),
          connectionId: msg.connectionId,
        };
        setNotifications((prev) => [newNotif, ...prev]);
        showToast(`New message from @${partnerAlias}`, 'info');
      }
    });

    socketInstance.on('partner-requested-reveal', () => {});

    socketInstance.on('mutual-reveal', (data: {
      connectionId: string;
      user1: { id: string; realName: string; avatarUrl: string };
      user2: { id: string; realName: string; avatarUrl: string };
    }) => {
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
      // Chat messages are no longer persisted in localStorage
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
      const partnerData = data.user1?.id === userIdRef.current ? data.user2 : data.user1;
      if (partnerData) {
        setActiveConnections((prev) =>
          prev.map((c) => {
            if (c.id === data.connectionId) {
              return {
                ...c,
                avatarUrl: partnerData.avatarUrl,
              };
            }
            return c;
          })
        );
        setActivePartner((prev) => {
          if (prev && prev.id === partnerData.id) {
            return {
              ...prev,
              avatarUrl: partnerData.avatarUrl,
            };
          }
          return prev;
        });
      }
    });

    socketInstance.on('location-synced', (data: { location: Location }) => {
      setCurrentLocation(data.location);
      setLocationSynced(true);
    });

    socketInstance.on('nearby-results', (data: SearchResult[] | { results: SearchResult[]; isGlobal?: boolean }) => {
      const rawList = Array.isArray(data) ? data : data.results;
      const wasGlobal = Array.isArray(data) ? false : !!data.isGlobal;
      
      // Safety: filter out self (handles multi-tab or userId regeneration edge cases)
      const resultsList = rawList.filter(u => u.userId !== userIdRef.current);
      
      setNearbyUsers(resultsList);
      setIsScanning(false);
      setBatchIndex(0);
      setActiveInterestFilter(null);
      
      if (resultsList.length === 0 && !wasGlobal) {
        setShowGlobalFallbackPrompt(true);
      } else {
        setShowGlobalFallbackPrompt(false);
      }
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

    // --- MULTIPLAYER GAME EVENT LISTENERS ---
    socketInstance.on('game-started', (data: { 
      gameType: 'tictactoe' | 'drawguess'; 
      scores: { [userId: string]: number };
      tictactoe?: { board: (string | null)[]; turn: string; winner: string | null };
      drawguess?: { drawerId: string; word?: string; hint: string };
    }) => {
      setActiveGame(data.gameType);
      setGameScores(data.scores);
      setShowGameSelector(false);
      setDgCelebration(null);
      setDgIncorrectGuess('');

      if (data.gameType === 'tictactoe' && data.tictactoe) {
        setTttBoard(data.tictactoe.board);
        setTttTurn(data.tictactoe.turn);
        setTttWinner(data.tictactoe.winner);
      } else if (data.gameType === 'drawguess' && data.drawguess) {
        setDgDrawerId(data.drawguess.drawerId);
        setDgWord(data.drawguess.word || '');
        setDgHint(data.drawguess.hint);
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
    });

    socketInstance.on('game-tictactoe-state', (data: { 
      board: (string | null)[]; 
      turn: string; 
      winner: string | null;
      scores: { [userId: string]: number };
    }) => {
      setTttBoard(data.board);
      setTttTurn(data.turn);
      setTttWinner(data.winner);
      setGameScores(data.scores);
    });

    socketInstance.on('game-draw-stroke', (stroke: { 
      x: number; y: number; prevX: number; prevY: number; color: string; size: number 
    }) => {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.beginPath();
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.size;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.moveTo(stroke.prevX, stroke.prevY);
          ctx.lineTo(stroke.x, stroke.y);
          ctx.stroke();
        }
      }
    });

    socketInstance.on('game-draw-clear', () => {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    });

    socketInstance.on('game-draw-correct', (data: { 
      winnerId: string; 
      scores: { [userId: string]: number };
      correctWord: string;
      nextDrawerId: string;
      nextHint: string;
    }) => {
      setGameScores(data.scores);
      const isMeWinner = data.winnerId === userId;
      // Accessing activePartner state directly is safe as it is set when the room is opened
      const winnerName = isMeWinner ? 'You' : 'Partner';
      setDgCelebration({ winnerAlias: winnerName, word: data.correctWord });
      
      setTimeout(() => {
        setDgCelebration(null);
      }, 2500);
    });

    socketInstance.on('game-draw-new-round', (data: {
      drawerId: string;
      hint: string;
      word?: string;
      scores: { [userId: string]: number };
    }) => {
      setDgDrawerId(data.drawerId);
      setDgHint(data.hint);
      setDgWord(data.word || '');
      setGameScores(data.scores);
      setDgGuessInput('');
      setDgIncorrectGuess('');
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    });

    socketInstance.on('game-draw-incorrect-guess', (data: { guess: string }) => {
      setDgIncorrectGuess(data.guess);
      setTimeout(() => {
        setDgIncorrectGuess('');
      }, 1500);
    });

    socketInstance.on('game-exited', () => {
      setActiveGame(null);
      setDgCelebration(null);
      setDgIncorrectGuess('');
    });

    socketInstance.on('new-drop', (drop: Drop) => {
      const user = regDataRef.current;
      if (isGlobalSearchActiveRef.current || drop.city === user.city) {
        setActiveDrops((prev) => {
          if (prev.some((d) => d.id === drop.id)) return prev;
          return [...prev, drop];
        });
      }
    });

    socketInstance.on('drop-removed', (data: { dropId: string }) => {
      setActiveDrops((prev) => prev.filter((d) => d.id !== data.dropId));
    });

    socketInstance.on('active-drops-list', (data: { drops: Drop[] }) => {
      setActiveDrops(data.drops);
    });

    socketInstance.on('create-drop-success', (_data: { dropId: string }) => {
      showToast('Drop placed successfully! 📍', 'success');
      setIsDropModalOpen(false);
      setIsUploading(false);
      setAudioBlob(null);
      setDropMessageText('');
      socketInstance.emit('get-active-drops', { userId: userIdRef.current, global: isGlobalSearchActiveRef.current });
    });

    socketInstance.on('incoming-drop-request', (data: {
      requestId: string;
      dropId: string;
      dropType: 'voice' | 'message';
      sender: {
        id: string;
        alias: string;
        avatarUrl?: string;
      };
    }) => {
      const newNotif: Notification = {
        id: `drop-req-${data.requestId}-${Date.now()}`,
        type: 'drop-request',
        fromUserId: data.sender.id,
        fromUserAlias: data.sender.alias,
        fromUserAvatarUrl: data.sender.avatarUrl,
        message: data.dropType === 'voice' ? 'waved back at your voice drop!' : 'replied to your message drop!',
        timestamp: new Date(),
        connectionId: data.requestId, // We use connectionId to store requestId for simplicity
        dropId: data.dropId,
        requestId: data.requestId,
        dropType: data.dropType
      };
      setNotifications((prev) => [newNotif, ...prev]);
      showToast(`Someone connected to your drop! 🎤`, 'info');
    });

    socketInstance.on('request-drop-success', (data: { dropId: string }) => {
      showToast('Connection request sent! Waiting for approval.', 'success');
      setRequestedDropIds((prev) => {
        const next = new Set(prev);
        next.add(data.dropId);
        return next;
      });
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Generate city coordinates with organic jitter (1-2.5 km offset)
  const getCityWithJitter = (city: City): Location => {
    const radius = 0.009 + Math.random() * 0.013; // 1km to 2.5km offset in degrees
    const angle = Math.random() * Math.PI * 2;
    return {
      lat: city.lat + radius * Math.sin(angle),
      lng: city.lng + radius * Math.cos(angle)
    };
  };

  // Fetch and sync selected city location
  const syncLocation = (cityName: string = selectedCity) => {
    if (!cityName) return;
    setLocationSynced(false);
    
    const city = INDIAN_CITIES.find(c => c.name === cityName);
    if (city) {
      const jitteredLoc = getCityWithJitter(city);
      setCurrentLocation(jitteredLoc);
      setLocationSynced(true);
      if (socket && isRegistered) {
        socket.emit('update-location', { userId, location: jitteredLoc });
      }
    } else {
      showToast('Selected city not found.', 'error');
    }
  };

  // Sync location on mount, registration, or when selected city changes
  useEffect(() => {
    syncLocation();
    setIsGlobalSearchActive(false); // Reset global search status when city changes
    setActiveInterestFilter(null);
    setBatchIndex(0);
  }, [isRegistered, socket, userId, selectedCity]);

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
    if (!selectedCity) {
      showToast('Please select your location first.', 'warning');
      return;
    }
    if (!currentLocation) {
      showToast('Waiting for location sync...', 'warning');
      return;
    }

    const generatedAvatar = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${gender}-${alias}`;
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
        gender,
        genderPreference,
        city: selectedCity,
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
    setShowGlobalFallbackPrompt(false);
    // Persist global search status if already active, otherwise default to local
    const isGlobal = isGlobalSearchActive;
    setSelectedNode(null);
    setSelectedDrop(null);
    setBatchIndex(0);
    setActiveInterestFilter(null);
    socket.emit('search-nearby', { userId, radius: 50, global: isGlobal });
    socket.emit('get-active-drops', { userId, global: isGlobal });
  };

  // Trigger global fallback search
  const handleGlobalSearch = () => {
    if (!socket || !userId) return;
    setIsScanning(true);
    setShowGlobalFallbackPrompt(false);
    setIsGlobalSearchActive(true);
    setSelectedNode(null);
    setSelectedDrop(null);
    setBatchIndex(0);
    setActiveInterestFilter(null);
    socket.emit('search-nearby', { userId, radius: 50, global: true });
    socket.emit('get-active-drops', { userId, global: true });
  };

  // Reset back to local city search
  const handleResetToLocalSearch = () => {
    if (!socket || !userId) return;
    setIsScanning(true);
    setShowGlobalFallbackPrompt(false);
    setIsGlobalSearchActive(false);
    setSelectedNode(null);
    setSelectedDrop(null);
    setBatchIndex(0);
    setActiveInterestFilter(null);
    socket.emit('search-nearby', { userId, radius: 50, global: false });
    socket.emit('get-active-drops', { userId, global: false });
  };

  const handleNextBatch = () => {
    const filteredUsers = nearbyUsers.filter(user => {
      if (!activeInterestFilter) return true;
      return user.interests && user.interests.includes(activeInterestFilter);
    });
    const totalBatches = Math.ceil(filteredUsers.length / 12);
    if (totalBatches <= 1) return;

    setIsScanning(true);
    setTimeout(() => {
      setBatchIndex((prev) => (prev + 1) % totalBatches);
      setIsScanning(false);
    }, 600);
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
  const handleAcceptRequest = (customConnId?: string, notificationId?: string) => {
    if (!socket) return;
    const finalConnId = customConnId || incomingRequest?.connectionId;
    if (!finalConnId) return;

    socket.emit('accept-connection-request', {
      connectionId: finalConnId,
      userId,
    });

    if (notificationId) {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    }
  };

  // Decline/Ignore incoming connection request
  const handleDeclineRequest = (notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    setShowNotifications(false);
  };

  // Click on a message notification to open chat room
  const handleSelectNotification = (notif: Notification) => {
    if (notif.type === 'message' && notif.connectionId) {
      const conn = activeConnections.find((c) => c.id === notif.connectionId);
      if (conn) {
        handleRecentCardClick(conn);
        setActiveTab('chats');
      }
    }
    setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
    setShowNotifications(false);
  };

  // Start recording voice note
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      setIsRecording(true);
      setRecordingSeconds(0);
      setAudioBlob(null);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 59) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);

      mediaRecorder.start();
    } catch (err) {
      console.error('Failed to start recording:', err);
      showToast('Microphone access denied or not available.', 'error');
    }
  };

  // Stop recording voice note
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setAudioDuration(recordingSeconds);
    }
  };

  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewPlayerRef = useRef<HTMLAudioElement | null>(null);

  const togglePreviewPlayback = () => {
    if (!audioBlob) return;

    if (isPreviewPlaying) {
      if (previewPlayerRef.current) {
        previewPlayerRef.current.pause();
      }
      setIsPreviewPlaying(false);
      return;
    }

    const url = URL.createObjectURL(audioBlob);
    const audio = new Audio(url);
    previewPlayerRef.current = audio;
    setIsPreviewPlaying(true);

    audio.addEventListener('ended', () => {
      setIsPreviewPlaying(false);
    });

    audio.play().catch(() => {
      setIsPreviewPlaying(false);
    });
  };

  const closeDropModal = () => {
    setIsDropModalOpen(false);
    if (isRecording) {
      stopRecording();
    }
    setAudioBlob(null);
    setDropMessageText('');
    if (previewPlayerRef.current) {
      previewPlayerRef.current.pause();
    }
    setIsPreviewPlaying(false);
  };

  const handlePublishDrop = async () => {
    if (!socket || !userId) return;

    if (dropType === 'message') {
      if (!dropMessageText.trim()) {
        showToast('Please type a message first.', 'warning');
        return;
      }
      setIsUploading(true);
      socket.emit('create-drop', {
        userId,
        type: 'message',
        messageText: dropMessageText
      });
    } else {
      if (!audioBlob) {
        showToast('Please record a voice note first.', 'warning');
        return;
      }
      setIsUploading(true);

      try {
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          try {
            const base64String = (reader.result as string).split(',')[1];
            const fileName = `${userId}-${Date.now()}.webm`;

            const response = await fetch(`${SOCKET_URL}/upload-audio`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                base64Data: base64String,
                fileName
              })
            });

            if (!response.ok) {
              throw new Error('Upload request failed');
            }

            const result = await response.json();
            const publicUrl = result.publicUrl;

            socket.emit('create-drop', {
              userId,
              type: 'voice',
              contentUrl: publicUrl,
              duration: audioDuration
            });
          } catch (err) {
            console.error('Failed to upload voice drop:', err);
            showToast('Failed to upload voice drop. Try again.', 'error');
            setIsUploading(false);
          }
        };
      } catch (err) {
        console.error('Failed to upload voice drop:', err);
        showToast('Failed to upload voice drop. Try again.', 'error');
        setIsUploading(false);
      }
    }
  };

  const handlePlayDropAudio = (drop: Drop) => {
    if (!drop.contentUrl) return;

    if (currentlyPlayingDropId === drop.id) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setCurrentlyPlayingDropId(null);
      setAudioPlaybackProgress(0);
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    setCurrentlyPlayingDropId(drop.id);
    setAudioPlaybackProgress(0);

    const audio = new Audio(drop.contentUrl);
    audioPlayerRef.current = audio;

    audio.addEventListener('timeupdate', () => {
      if (audio.duration) {
        setAudioPlaybackProgress((audio.currentTime / audio.duration) * 100);
      }
    });

    audio.addEventListener('ended', () => {
      setCurrentlyPlayingDropId(null);
      setAudioPlaybackProgress(0);
    });

    audio.addEventListener('error', () => {
      showToast('Failed to play audio drop clip.', 'error');
      setCurrentlyPlayingDropId(null);
      setAudioPlaybackProgress(0);
    });

    audio.play().catch((err) => {
      console.error('Audio play error:', err);
      showToast('Could not play audio. Check browser permissions.', 'error');
      setCurrentlyPlayingDropId(null);
      setAudioPlaybackProgress(0);
    });
  };

  const handleTapDrop = (drop: Drop) => {
    setSelectedNode(null);
    setSelectedDrop(drop);
    if (drop.type === 'voice') {
      handlePlayDropAudio(drop);
    }
  };

  const handleConnectDrop = (drop: Drop) => {
    if (!socket || !userId) return;
    socket.emit('request-drop-connection', { dropId: drop.id, senderId: userId });
    setSelectedDrop(null);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    setCurrentlyPlayingDropId(null);
    setAudioPlaybackProgress(0);
  };

  const handleAcceptDropRequest = (requestId: string, dropId: string, senderId: string, notificationId: string) => {
    if (!socket || !userId) return;
    socket.emit('accept-drop-request', {
      requestId,
      dropId,
      senderId,
      accepterId: userId
    });
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  const handleDeclineDropRequest = (notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  // Click on a connection card to open chat room and load history
  const handleRecentCardClick = (conn: any) => {
    if (!isRegistered) {
      showToast('Please enter the Discovery Bubble first by completing your profile!', 'warning');
      return;
    }
    setActiveConnectionId(conn.id);
    setActivePartner({ id: conn.partnerId, alias: conn.partnerAlias, avatarUrl: conn.avatarUrl });
    if (socket) {
      socket.emit('get-chat-history', { connectionId: conn.id });
    }
  };

  // --- MULTIPLAYER GAME HELPER FUNCTIONS ---

  // Initiate a game session
  const handleStartGame = (gameType: 'tictactoe' | 'drawguess') => {
    if (!socket || !activeConnectionId || !userId) return;
    socket.emit('game-start', {
      connectionId: activeConnectionId,
      gameType,
      fromUserId: userId
    });
    setShowGameSelector(false);
  };

  // Click on a Tic Tac Toe cell
  const handleTttCellClick = (index: number) => {
    if (activeGame !== 'tictactoe' || !socket || !activeConnectionId || !userId) return;
    if (tttTurn !== userId) {
      showToast("It's not your turn!", 'warning');
      return;
    }
    if (tttBoard[index] !== null) return;
    if (tttWinner) return;

    socket.emit('game-tictactoe-move', {
      connectionId: activeConnectionId,
      userId,
      cellIndex: index
    });
  };

  // Reset/Replay Tic Tac Toe
  const handleTttReset = () => {
    if (!socket || !activeConnectionId || !userId) return;
    socket.emit('game-start', {
      connectionId: activeConnectionId,
      gameType: 'tictactoe',
      fromUserId: userId
    });
  };

  // Draw & Guess Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (activeGame !== 'drawguess' || dgDrawerId !== userId || !canvasRef.current) return;
    isDrawingRef.current = true;
    const coords = getCanvasCoords(e);
    prevCoordsRef.current = coords;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !canvasRef.current || !prevCoordsRef.current || !socket || !activeConnectionId) return;
    
    // Prevent scrolling on mobile touch screens
    if (e.cancelable) {
      e.preventDefault();
    }

    const coords = getCanvasCoords(e);
    const prev = prevCoordsRef.current;
    
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      
      socket.emit('game-draw-stroke', {
        connectionId: activeConnectionId,
        stroke: {
          x: coords.x,
          y: coords.y,
          prevX: prev.x,
          prevY: prev.y,
          color: drawColor,
          size: brushSize
        }
      });
      
      prevCoordsRef.current = coords;
    }
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
    prevCoordsRef.current = null;
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;
    
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    // Scale coords to match canvas internal coordinates (500x350)
    const x = ((clientX - rect.left) / rect.width) * canvasRef.current.width;
    const y = ((clientY - rect.top) / rect.height) * canvasRef.current.height;
    
    return { x, y };
  };

  const clearCanvas = () => {
    if (!canvasRef.current || !socket || !activeConnectionId) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    socket.emit('game-draw-clear', { connectionId: activeConnectionId });
  };

  // Submit guess
  const handleSendGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dgGuessInput.trim() || !socket || !activeConnectionId || !userId) return;

    socket.emit('game-draw-guess', {
      connectionId: activeConnectionId,
      guess: dgGuessInput.trim(),
      userId
    });
    setDgGuessInput('');
  };

  // Exit/Close current game
  const handleExitGame = () => {
    if (!socket || !activeConnectionId) return;
    socket.emit('game-exit', { connectionId: activeConnectionId });
    setActiveGame(null);
    setDgCelebration(null);
    setDgIncorrectGuess('');
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



  const handleSafetyAction = (action: 'delete' | 'block' | 'report', connectionId: string) => {
    if (!socket) return;
    
    // Clear device cached chat messages
    // Chat messages are no longer persisted in localStorage
    
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

  // Render notification dropdown drawer (used on both desktop and mobile headers)
  const renderNotificationDropdown = () => {
    if (!showNotifications) return null;
    return (
      <div className="notification-dropdown glass-panel animate-scaleUp">
        <div className="notif-header">
          <h4>Notifications</h4>
          {notifications.length > 0 && (
            <button onClick={() => setNotifications([])} className="clear-all-btn">
              Clear All
            </button>
          )}
        </div>
        
        <div className="notif-list">
          {notifications.length === 0 ? (
            <div className="notif-empty">
              <BellOff className="w-8 h-8 text-text-muted mb-2" />
              <p>No new notifications</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className="notif-item">
                <div className="notif-avatar">
                  <img src={n.fromUserAvatarUrl || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${n.fromUserAlias}`} alt="Avatar" className="w-full h-full object-cover" />
                </div>
                
                <div className="notif-body">
                  {n.type === 'wave' ? (
                    <>
                      <p className="notif-text">
                        <span className="font-bold text-violet-400">@{n.fromUserAlias}</span> sent you a wave request!
                      </p>
                      {n.message && <p className="notif-message-bubble">"{n.message}"</p>}
                      <div className="notif-actions">
                        <button 
                          className="notif-btn-accept" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptRequest(n.connectionId || '', n.id);
                          }}
                        >
                          Accept
                        </button>
                        <button 
                          className="notif-btn-decline" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeclineRequest(n.id);
                          }}
                        >
                          Ignore
                        </button>
                      </div>
                    </>
                  ) : n.type === 'drop-request' ? (
                    <>
                      <p className="notif-text">
                        <span className="font-bold text-violet-400">@{n.fromUserAlias}</span> waved back at your {n.dropType === 'voice' ? 'Voice Drop 🎤' : 'Message Drop ✉️'}!
                      </p>
                      <div className="notif-actions">
                        <button 
                          className="notif-btn-accept" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptDropRequest(n.requestId || '', n.dropId || '', n.fromUserId, n.id);
                          }}
                        >
                          Accept
                        </button>
                        <button 
                          className="notif-btn-decline" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeclineDropRequest(n.id);
                          }}
                        >
                          Ignore
                        </button>
                      </div>
                    </>
                  ) : (
                    <div onClick={() => handleSelectNotification(n)} className="cursor-pointer">
                      <p className="notif-text">
                        New message from <span className="font-bold text-cyan-400">@{n.fromUserAlias}</span>
                      </p>
                      <p className="notif-preview">{n.message}</p>
                      <span className="notif-time">Click to reply</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const sortedNearbyUsers = useMemo(() => {
    return [...nearbyUsers].sort((a, b) => {
      const sharedA = a.interests ? a.interests.filter(tag => selectedTags.includes(tag)).length : 0;
      const sharedB = b.interests ? b.interests.filter(tag => selectedTags.includes(tag)).length : 0;
      return sharedB - sharedA;
    });
  }, [nearbyUsers, selectedTags]);

  const filteredUsers = sortedNearbyUsers.filter(user => {
    if (!activeInterestFilter) return true;
    return user.interests && user.interests.includes(activeInterestFilter);
  });
  const totalBatches = Math.ceil(filteredUsers.length / 12);
  const visibleUsersBatch = filteredUsers.slice(batchIndex * 12, (batchIndex + 1) * 12);

  return (
    <div className={`flex-1 flex flex-col min-h-screen ${isRegistered && activeTab === 'home' && !activeConnectionId ? 'p-2 md:p-4' : 'p-4 md:p-8'}`}>
      
      {/* Background Neon Gradients */}
      <div className="absolute rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" style={{ top: '10%', left: '20%', width: '350px', height: '350px' }}></div>
      <div className="absolute rounded-full bg-cyan-900/10 blur-[120px] pointer-events-none" style={{ bottom: '10%', right: '20%', width: '350px', height: '350px' }}></div>

      {/* Mobile Top Header */}
      {!activeConnectionId && !(isRegistered && activeTab === 'home') && (
        <header className="mobile-header">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Ghost className="w-4 h-4 text-white" />
          </div>
          <span className="font-space font-bold text-white text-sm">InstantMeet</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={`mobile-gps-pill ${locationSynced ? 'synced' : 'syncing'}`}>
            <MapPin className="w-3.5 h-3.5" />
            <span>{selectedCity}</span>
          </div>

          <div className="relative flex items-center">
            <button 
              className={`bell-btn ${notifications.length > 0 ? 'has-notifications' : ''}`} 
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="bell-badge-dot"></span>
              )}
            </button>
            {renderNotificationDropdown()}
          </div>

          <div 
            onClick={() => { setActiveTab('settings'); setActiveConnectionId(null); }}
            className="w-8 h-8 rounded-full border border-white/10 overflow-hidden bg-white/5 flex items-center justify-center cursor-pointer"
            title="Profile Settings"
          >
            <img src={avatarUrl || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${alias}`} alt="Avatar" className="w-full h-full object-cover" />
          </div>
        </div>
      </header>
      )}

      {/* Mobile Bottom Navigation */}
      {!activeConnectionId && !(isRegistered && activeTab === 'home') && (
        <nav className="mobile-bottom-nav">
        <button 
          onClick={() => { setActiveTab('home'); setActiveConnectionId(null); }}
          className={`mobile-nav-btn ${activeTab === 'home' && !activeConnectionId ? 'active' : ''}`}
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
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
      )}

      {/* Main Masterpiece 3-Column Grid Layout */}
      <div className={`dashboard-container ${activeConnectionId ? 'chat-active-mobile' : ''} ${isRegistered && activeTab === 'home' && !activeConnectionId ? 'full-radar-layout' : ''}`}>
           {/* ================= COLUMN 1: LEFT SIDEBAR ================= */}
        {!(isRegistered && activeTab === 'home' && !activeConnectionId) && (
          <aside className="sidebar-left">
          <div className="logo-section flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Ghost className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-gradient" style={{ fontSize: '1.25rem' }}>InstantMeet</h2>
              <p className="text-[11px] text-text-muted font-medium mt-0.5">Anonymous. Real. Instant.</p>
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
                <p className="text-[10px] text-text-muted mt-0.5">Your identity is always secure and hidden.</p>
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
                  📍 {selectedCity || 'Not Selected'}
                </p>
                <p className={`text-[10px] font-medium mt-0.5 ${locationSynced ? 'text-violet-400' : 'text-amber-400 animate-pulse'}`}>
                  {locationSynced ? 'City Mode Active' : (selectedCity ? 'Syncing City...' : 'Select a City')}
                </p>
              </div>
            </div>
            
          </div>

          {/* Footer Copyright */}
          <div className="mt-auto pt-4 text-[10px] text-text-muted" style={{ paddingLeft: '12px' }}>
            © {new Date().getFullYear()} InstantMeet
          </div>
        </aside>
        )}

        {/* ================= COLUMN 2: CENTER WORKSPACE ================= */}
        <section className="flex-1 flex flex-col gap-6">
          
          {/* A. Onboarding / Profile Bar at the Top */}
          {!isRegistered && (
            <div className="glass-panel profile-onboarding-bar">
              <div className="profile-onboarding-header">
                <h3 className="profile-onboarding-title">
                  Complete your anonymous profile 
                  <svg className="animated-emoji" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="emojiGold" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ffe066" />
                        <stop offset="100%" stopColor="#ffb703" />
                      </linearGradient>
                    </defs>
                    <circle cx="12" cy="12" r="10" fill="url(#emojiGold)" className="emoji-body" />
                    <g className="emoji-face">
                      <circle cx="9" cy="10" r="1.2" fill="#1e1b4b" />
                      <circle cx="15" cy="10" r="1.2" fill="#1e1b4b" />
                      <path d="M8 14.5 C 9 17, 15 17, 16 14.5" stroke="#1e1b4b" strokeWidth="1.2" strokeLinecap="round" fill="none" />
                    </g>
                  </svg>
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
                      placeholder="Enter your name"
                      className="bar-input display-name-input"
                    />
                  </div>

                  <div className="bar-input-group">
                    <label>Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                      className="bar-input display-name-input cursor-pointer"
                      style={{
                        background: 'rgba(30, 20, 74, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        padding: '10px 14px',
                        color: '#fff',
                        fontSize: '0.9rem',
                        height: '42px',
                        outline: 'none',
                        minWidth: '100px',
                      }}
                    >
                      <option value="male" style={{ background: '#120c2d', color: '#fff' }}>Male</option>
                      <option value="female" style={{ background: '#120c2d', color: '#fff' }}>Female</option>
                    </select>
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

                  <div className="bar-input-group flex-1" style={{ minWidth: '240px' }}>
                    <label>
                      <MapPin className="w-4 h-4 text-violet-400" />
                      <span>Select City</span>
                    </label>
                    
                    <div className="flex flex-col gap-2">
                      <select
                        value={selectedCity}
                        onChange={(e) => setSelectedCity(e.target.value)}
                        className="bar-input w-full cursor-pointer"
                        style={{
                          background: 'rgba(30, 20, 74, 0.4)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          padding: '10px 14px',
                          color: selectedCity ? '#fff' : 'rgba(255, 255, 255, 0.4)',
                          fontSize: '0.9rem',
                          height: '42px',
                          outline: 'none',
                        }}
                      >
                        <option value="" disabled hidden style={{ background: '#120c2d', color: 'rgba(255, 255, 255, 0.4)' }}>
                          Enter your location
                        </option>
                        {INDIAN_CITIES.map((c) => (
                          <option key={c.name} value={c.name} style={{ background: '#120c2d', color: '#fff' }}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="bar-input-group flex-1" style={{ minWidth: '160px' }}>
                    <label>
                      <Heart className="w-4 h-4 text-violet-400" />
                      <span>Interested In</span>
                    </label>
                    
                    <div className="flex flex-col gap-2">
                      <select
                        value={genderPreference}
                        onChange={(e) => setGenderPreference(e.target.value as 'male' | 'female' | 'any')}
                        className="bar-input w-full cursor-pointer"
                        style={{
                          background: 'rgba(30, 20, 74, 0.4)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          padding: '10px 14px',
                          color: '#fff',
                          fontSize: '0.9rem',
                          height: '42px',
                          outline: 'none',
                        }}
                      >
                        <option value="any" style={{ background: '#120c2d', color: '#fff' }}>Any Gender</option>
                        <option value="male" style={{ background: '#120c2d', color: '#fff' }}>Male</option>
                        <option value="female" style={{ background: '#120c2d', color: '#fff' }}>Female</option>
                      </select>
                    </div>
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

                  <div className="onboarding-action-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                    <button 
                      onClick={() => handleRegisterOrEnter()}
                      className="btn-primary onboarding-gradient-btn"
                      disabled={!isConnected}
                      style={{ opacity: isConnected ? 1 : 0.7, cursor: isConnected ? 'pointer' : 'not-allowed' }}
                    >
                      {!isConnected ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Connecting to Server...</span>
                        </>
                      ) : (
                        <>
                          <span>Search People</span>
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                    <span className="text-[10px] text-text-muted" style={{ textTransform: 'none' }}>
                      By entering, you agree to our{' '}
                      <button 
                        onClick={() => setShowTermsModal(true)} 
                        className="text-violet-400 font-semibold hover:underline bg-transparent border-none p-0 cursor-pointer"
                        style={{ fontSize: '10px', textTransform: 'none' }}
                      >
                        Terms of Service & Privacy Policy
                      </button>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* B. Centerpiece View (Radar Orb OR Active Chat Room) */}
          <div 
            ref={glassPanelRef}
            className={`glass-panel flex-1 flex flex-col justify-center items-center min-h-[420px] ${activeConnectionId ? 'p-3 md:p-6 chat-active-panel' : 'p-6'}`}
            style={{ 
              position: 'relative',
              overflowY: (selectedDrop || selectedNode || showGlobalFallbackPrompt) ? 'auto' : 'visible'
            }}
          >
            
            {isRegistered && !activeConnectionId && activeTab === 'home' && (
              <button
                id="edit-profile-btn"
                onClick={() => setIsRegistered(false)}
                className="p-2 rounded-lg bg-white/5 border border-white/10 text-text-secondary hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer z-10"
                style={{ position: 'absolute', top: '16px', left: '16px' }}
                title="Go Back & Edit Profile"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            )}


            {errorMsg && (
              <div className="absolute top-4 left-4 right-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                <span>{errorMsg}</span>
              </div>
            )}

            {!activeConnectionId ? (
              activeTab === 'home' ? (
                !isRegistered ? (
                  /* Premium Welcome / Radar Standby Panel */
                  <div className="flex flex-col items-center justify-center text-center p-6 md:p-10 max-w-lg mx-auto animate-fadeIn w-full" style={{ animationDuration: '0.4s' }}>
                    
                    {/* Rotating Radar Container */}
                    <div className="flex items-center justify-center mb-6">
                      <div 
                        style={{ 
                          width: '110px', 
                          height: '110px', 
                          border: '1px solid rgba(139, 92, 246, 0.3)', 
                          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, rgba(15, 10, 40, 0.8) 100%)', 
                          borderRadius: '50%', 
                          position: 'relative', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          overflow: 'hidden',
                          boxShadow: '0 0 30px rgba(139, 92, 246, 0.15)'
                        }}
                      >
                        {/* Concentric rings */}
                        <div className="absolute w-20 h-20 rounded-full" style={{ border: '1px dashed rgba(139, 92, 246, 0.15)' }}></div>
                        <div className="absolute w-10 h-10 rounded-full" style={{ border: '1px solid rgba(139, 92, 246, 0.1)' }}></div>
                        
                        {/* Radar Sweep Line */}
                        <div 
                          className="absolute inset-0 animate-spin" 
                          style={{ 
                            animationDuration: '3s', 
                            transformOrigin: 'center center'
                          }}
                        >
                          <div 
                            style={{ 
                              position: 'absolute',
                              top: '0',
                              left: '50%',
                              width: '2px',
                              height: '50%',
                              background: 'linear-gradient(to top, rgba(34, 211, 238, 0.05) 0%, rgba(34, 211, 238, 0.8) 100%)',
                              boxShadow: '0 0 10px rgba(34, 211, 238, 0.5)'
                            }}
                          ></div>
                          {/* Fading trail quadrant */}
                          <div 
                            style={{
                              position: 'absolute',
                              inset: '0',
                              background: 'conic-gradient(from 180deg at 50% 50%, transparent 75%, rgba(34, 211, 238, 0.12) 100%)',
                              borderRadius: '50%'
                            }}
                          ></div>
                        </div>
                        
                        {/* Center Beacon */}
                        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)] animate-pulse z-10"></div>
                      </div>
                    </div>

                    {/* Badge */}
                    <div className="mb-3">
                      <span className="text-[10px] uppercase tracking-[0.25em] text-cyan-400 font-bold bg-cyan-950/40 border border-cyan-500/20 px-3 py-1 rounded-full">
                        radar system
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-2xl font-extrabold font-space text-white tracking-tight mb-3">
                      Standby Mode
                    </h3>
                    
                    {/* Description */}
                    <p className="text-xs leading-relaxed max-w-sm mx-auto mb-3" style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px' }}>
                      InstantMeet connects you anonymously in real-time. Click <strong className="text-violet-300 font-semibold">Search People</strong> to scan your city, or click <strong className="text-violet-300 font-semibold">Drop Note</strong> to pin a voice note or message on the radar for others to find!
                    </p>
                    <p className="text-[11px] leading-relaxed max-w-sm mx-auto mb-8 text-amber-400/80 flex items-center justify-center gap-1">
                      <span>⚠️ Note: If you leave the app, active chats & drops delete after 1 minute of absence.</span>
                    </p>

                    {/* Status Pill */}
                    <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold tracking-wide shadow-inner">
                      <div className={`w-2 h-2 rounded-full ${selectedCity ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]'}`}></div>
                      <span className={selectedCity ? 'text-cyan-300' : 'text-amber-300'} style={{ fontSize: '12px' }}>
                        {selectedCity ? `Scanner ready to search in ${selectedCity}` : 'Please select your city above to sync radar'}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Saturn Radar Orb Centerpiece */
                  <div className="orb-discovery-centerpiece w-full">
                    <div ref={orbContainerRef} className="planet-orb-container glow-primary">
                      {isScanning && <div className="orb-sweep-beam"></div>}
                      <div className="planet-ring"></div>
                      
                      {/* Glowing core sphere */}
                      <div className="planet-orb">
                        <span className="text-4xl font-extrabold font-space">
                          {isScanning ? <Loader2 className="w-8 h-8 animate-spin" /> : filteredUsers.length}
                        </span>
                        <span className="text-[11px] uppercase tracking-wider text-violet-300 font-semibold mt-1">people online</span>
                        <span className="text-[9px] text-text-secondary mt-0.5">{isGlobalSearchActive ? 'globally' : `in ${selectedCity}`}</span>
                      </div>

                      {/* Real-time matched users positioned around the orb ring */}
                      {!isScanning && visibleUsersBatch.map((nu, i) => {
                        const angle = (i * 360) / (visibleUsersBatch.length || 1) - 30;
                        const radian = (angle * Math.PI) / 180;
                        
                        // Alternate between 3 orbits (0: inner, 1: middle, 2: outer)
                        const orbitIndex = i % 3;
                        
                        // Calculate radius dynamically based on viewport size
                        const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
                        
                        let baseRadius = 115; // middle orbit on desktop
                        if (orbitIndex === 0) baseRadius = 95; // inner
                        if (orbitIndex === 2) baseRadius = 135; // outer
                        
                        if (isMobile) {
                          baseRadius = 90; // middle on mobile
                          if (orbitIndex === 0) baseRadius = 75; // inner
                          if (orbitIndex === 2) baseRadius = 105; // outer
                        }

                        const x = Math.cos(radian) * baseRadius;
                        const y = Math.sin(radian) * baseRadius;

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

                      {/* Floating Voice & Message Drops scattered outside orbits */}
                      {!isScanning && getDropPositions(
                        displayedDrops.filter(d => !requestedDropIds.has(d.id)).slice(0, 25),
                        radarBounds,
                        visibleUsersBatch.length
                      ).map(({ drop, x, y }) => {
                        const isVoice = drop.type === 'voice';
                        const isPlaying = currentlyPlayingDropId === drop.id;
                        
                        return (
                          <div
                            key={drop.id}
                            style={{
                              position: 'absolute',
                              left: '50%',
                              top: '50%',
                              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                              zIndex: 5
                            }}
                            className="absolute flex items-center justify-center animate-fadeIn"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTapDrop(drop);
                              }}
                              style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                border: isPlaying 
                                  ? '2px solid #22d3ee'
                                  : isVoice 
                                    ? '1.5px solid rgba(139, 92, 246, 0.5)'
                                    : '1.5px solid rgba(16, 185, 129, 0.5)',
                                color: isPlaying 
                                  ? '#22d3ee' 
                                  : isVoice 
                                    ? '#c084fc' 
                                    : '#34d399',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: isPlaying 
                                  ? '0 0 15px rgba(34, 211, 238, 0.6)' 
                                  : '0 4px 12px rgba(0, 0, 0, 0.3)',
                                position: 'relative',
                                outline: 'none'
                              }}
                              className="hover:scale-110"
                            >
                              {/* If voice note is playing, show a circular progress ring around the emoji */}
                              {isPlaying && (
                                <svg className="absolute inset-0 w-full h-full -rotate-90">
                                  <circle
                                    cx="21"
                                    cy="21"
                                    r="19"
                                    stroke="#22d3ee"
                                    strokeWidth="2.5"
                                    fill="transparent"
                                    strokeDasharray="119.38"
                                    strokeDashoffset={119.38 - (119.38 * audioPlaybackProgress) / 100}
                                    className="transition-all duration-100"
                                  />
                                </svg>
                              )}
                              
                              {/* Drop Emoji */}
                              <span className="text-xl select-none" style={{ fontSize: '18px' }}>
                                {isVoice ? '🎤' : '✉️'}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Vibe filter pills toggles */}
                    {isRegistered && nearbyUsers.length > 0 && (
                      <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto mb-6 px-4">
                        {selectedTags.map(tag => {
                          const isActive = activeInterestFilter === tag;
                          return (
                            <button
                              key={tag}
                              onClick={() => {
                                setActiveInterestFilter(isActive ? null : tag);
                                setBatchIndex(0);
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-300 ${
                                isActive
                                  ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-500/30 scale-105'
                                  : 'bg-white/5 border-white/10 text-violet-300 hover:bg-white/10 hover:border-violet-500/30'
                              }`}
                            >
                              #{tag}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div id="bottom-controls-area" className="flex flex-col items-center gap-4">
                      {selectedDrop ? (
                        <div className="glass-panel p-4 md:p-5 flex flex-col items-center text-center max-w-xs border-violet-500/20 animate-fadeIn" style={{ animationDuration: '0.3s', position: 'relative' }}>
                          <button
                            onClick={() => {
                              setSelectedDrop(null);
                              if (audioPlayerRef.current) {
                                audioPlayerRef.current.pause();
                                setCurrentlyPlayingDropId(null);
                                setAudioPlaybackProgress(0);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-text-secondary hover:text-white hover:bg-white/10 transition-all flex items-center justify-center cursor-pointer z-10"
                            style={{ position: 'absolute', top: '12px', right: '12px' }}
                            title="Close Details"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          
                          <div className="w-10 h-10 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-2">
                            <span className="text-xl">{selectedDrop.type === 'voice' ? '🎤' : '✉️'}</span>
                          </div>

                          <h4 className="font-extrabold text-white text-base tracking-tight">
                            {selectedDrop.type === 'voice' ? 'Anonymous Voice Drop' : 'Anonymous Message Drop'}
                          </h4>
                          
                          <p className="text-[10px] text-violet-300 font-semibold mt-0.5">
                            Dropped in {selectedDrop.city} • {new Date(selectedDrop.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>

                          {selectedDrop.type === 'voice' ? (
                            <div className="w-full flex flex-col items-center mt-2">
                              <button
                                onClick={() => handlePlayDropAudio(selectedDrop)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all duration-300 ${
                                  currentlyPlayingDropId === selectedDrop.id
                                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                                    : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                                }`}
                              >
                                {currentlyPlayingDropId === selectedDrop.id ? (
                                  <>
                                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                                    <span>Playing ({selectedDrop.duration || 60}s)</span>
                                  </>
                                ) : (
                                  <>
                                    <span>▶️</span>
                                    <span>Play Voice Note</span>
                                  </>
                                )}
                              </button>
                            </div>
                          ) : (
                            <div className="w-full mt-2 p-2.5 bg-white/5 border border-white/10 rounded-xl relative">
                              <p className="text-xs text-white leading-relaxed text-center italic" style={{ textTransform: 'none' }}>
                                "{selectedDrop.messageText}"
                              </p>
                            </div>
                          )}

                          <button 
                            onClick={() => handleConnectDrop(selectedDrop)}
                            className="btn-primary py-2 px-6 mt-3.5 text-xs font-bold tracking-wider w-full max-w-[210px] shadow-lg shadow-violet-500/25 transition-all duration-300 hover:scale-[1.03]"
                          >
                            Connect Chat
                          </button>
                        </div>
                      ) : selectedNode ? (
                        <div className="glass-panel p-4 md:p-5 flex flex-col items-center text-center max-w-xs border-cyan-500/20 animate-fadeIn" style={{ animationDuration: '0.3s', position: 'relative' }}>
                          <button
                            onClick={() => setSelectedNode(null)}
                            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-text-secondary hover:text-white hover:bg-white/10 transition-all flex items-center justify-center cursor-pointer z-10"
                            style={{ position: 'absolute', top: '12px', right: '12px' }}
                            title="Close Details"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <h4 className="font-extrabold text-white text-lg tracking-tight">@{selectedNode.alias}</h4>
                          <p className="text-xs text-cyan-400 font-semibold mt-1">
                            Online in {selectedNode.city || selectedCity}{selectedNode.age > 0 ? ` • ${selectedNode.age}y/o` : ''}{selectedNode.gender ? ` • ${selectedNode.gender.charAt(0).toUpperCase() + selectedNode.gender.slice(1)}` : ''}
                          </p>
                          <div className="flex flex-wrap gap-2 justify-center mt-2.5 mb-2">
                            {selectedNode.interests.length > 0 ? (
                               selectedNode.interests.slice(0, 3).map(tag => (
                                 <span key={tag} className="text-[10px] px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 font-medium tracking-wide">
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
                            className="btn-primary py-2 px-6 mt-3 text-xs font-bold tracking-wider w-full max-w-[210px] shadow-lg shadow-violet-500/25 transition-all duration-300 hover:scale-[1.03]"
                          >
                            Connect Chat
                          </button>
                        </div>
                      ) : showGlobalFallbackPrompt ? (
                        <div className="glass-panel p-4 flex flex-col items-center text-center max-w-xs border-violet-500/20 animate-fadeIn" style={{ animationDuration: '0.3s' }}>
                          <Globe className="w-6 h-6 text-violet-400 animate-pulse mb-2" />
                          <h4 className="font-bold text-white text-sm">No matches in {selectedCity}</h4>
                          <p className="text-[11px] text-text-secondary mt-1">
                            No one is online in your city right now. Would you like to expand your search and match with someone globally?
                          </p>
                          


                          <div className="flex gap-2 mt-4 w-full">
                            <button 
                              onClick={handleGlobalSearch}
                              className="btn-primary py-2 px-3 flex-1 text-xs"
                              style={{ minWidth: 'unset', padding: '10px' }}
                            >
                              Search Globally
                            </button>
                            <button 
                              onClick={() => setShowGlobalFallbackPrompt(false)}
                              className="change-location-btn py-2 px-3 flex-1 text-xs"
                              style={{ justifyContent: 'center', padding: '10px' }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3 w-full">
                          <div className="flex flex-wrap gap-3 justify-center items-center w-full">
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
                                  Search People
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => {
                                setIsDropModalOpen(true);
                                setDropType('voice');
                                setDropMessageText('');
                                setAudioBlob(null);
                                setAudioDuration(0);
                                setRecordingSeconds(0);
                              }}
                              disabled={isScanning || !isRegistered}
                              className="btn-secondary-drop"
                            >
                              <span>Drop Note 📍</span>
                            </button>

                            {isGlobalSearchActive && !isScanning && (
                              <button
                                onClick={handleResetToLocalSearch}
                                className="change-location-btn py-2 px-3 text-xs"
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '42px', minWidth: 'unset', justifyContent: 'center' }}
                              >
                                <MapPin className="w-3.5 h-3.5 text-violet-400" />
                                <span>Search in {selectedCity}</span>
                              </button>
                            )}

                            {totalBatches > 1 && !isScanning && (
                              <button
                                onClick={handleNextBatch}
                                className="btn-primary flex items-center gap-1.5"
                              >
                                Sweep ({batchIndex + 1}/{totalBatches}) 🔄
                              </button>
                            )}
                          </div>
                          

                        </div>
                      )}
                      
                      <span className="text-[10px] text-text-muted flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-text-muted" /> We never share your exact location
                      </span>
                    </div>
                  </div>
                )
              ) : activeTab === 'chats' ? (
                /* Chats Tab Centerpiece */
                <div className="w-full flex flex-col p-4 md:p-6 text-left">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-xl font-bold font-space text-white">Active Secure Threads</h3>
                      <p className="text-xs text-text-secondary mt-1">Chat securely and anonymously in real-time.</p>
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
                          Find active users on your Home discovery radar and click "Connect" to open a secure chat thread!
                        </p>
                      </div>
                    ) : (
                      activeConnections.map(c => (
                        <div key={c.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between hover:border-violet-500/20 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full border border-violet-500/20 overflow-hidden bg-white/5 flex items-center justify-center relative">
                              <img 
                                src={c.avatarUrl || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${c.partnerAlias}`} 
                                alt="Avatar" 
                                className="w-full h-full object-cover" 
                              />
                              {c.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-bg-primary"></div>}
                            </div>
                            <div>
                              <h4 className="font-bold text-white text-sm">
                                @{c.partnerAlias}
                              </h4>
                              <p className="text-xs text-text-secondary mt-0.5">
                                Active Chat • {c.time}
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

                    {/* Active Cities Breakdown */}
                    <div className="flex flex-col gap-3">
                      <h4 className="text-xs uppercase font-bold tracking-wider text-text-muted">Active Cities Breakdown</h4>
                      <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2">
                        {!adminStats.cities || Object.keys(adminStats.cities).length === 0 ? (
                          <p className="text-xs text-text-secondary text-center italic">No active city traffic recorded yet.</p>
                        ) : (
                          Object.entries(adminStats.cities)
                            .sort((a, b) => b[1] - a[1])
                            .map(([city, count]) => (
                              <div key={city} className="flex justify-between items-center text-xs py-1 border-b border-white/5 last:border-0">
                                <span className="font-semibold text-white">📍 {city}</span>
                                <span className="px-2.5 py-0.5 rounded bg-violet-600/20 text-violet-400 font-bold">{count} online</span>
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
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-end">
                        <div className="flex-1 flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">Current City</label>
                          <select
                            value={selectedCity}
                            onChange={(e) => setSelectedCity(e.target.value)}
                            className="bar-input w-full cursor-pointer"
                            style={{
                              background: 'rgba(30, 20, 74, 0.4)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '12px',
                              padding: '10px 14px',
                              color: '#fff',
                              fontSize: '0.9rem',
                              height: '42px',
                              outline: 'none',
                            }}
                          >
                            {INDIAN_CITIES.map((c) => (
                              <option key={c.name} value={c.name} style={{ background: '#120c2d', color: '#fff' }}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex-1 flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">Interested In (Gender Preference)</label>
                          <select
                            value={genderPreference}
                            onChange={(e) => setGenderPreference(e.target.value as 'male' | 'female' | 'any')}
                            className="bar-input w-full cursor-pointer"
                            style={{
                              background: 'rgba(30, 20, 74, 0.4)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '12px',
                              padding: '10px 14px',
                              color: '#fff',
                              fontSize: '0.9rem',
                              height: '42px',
                              outline: 'none',
                            }}
                          >
                            <option value="any" style={{ background: '#120c2d', color: '#fff' }}>Any Gender</option>
                            <option value="male" style={{ background: '#120c2d', color: '#fff' }}>Male</option>
                            <option value="female" style={{ background: '#120c2d', color: '#fff' }}>Female</option>
                          </select>
                        </div>
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

                        <div className="w-32 flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">Gender</label>
                          <select
                            value={gender}
                            onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                            className="bar-input w-full cursor-pointer"
                            style={{
                              background: 'rgba(30, 20, 74, 0.4)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '12px',
                              padding: '10px 14px',
                              color: '#fff',
                              fontSize: '0.9rem',
                              height: '42px',
                              outline: 'none',
                            }}
                          >
                            <option value="male" style={{ background: '#120c2d', color: '#fff' }}>Male</option>
                            <option value="female" style={{ background: '#120c2d', color: '#fff' }}>Female</option>
                          </select>
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


                    </div>

                    <hr className="border-white/5" />

                    <div className="flex flex-col gap-4">
                      <span className="text-xs uppercase font-bold tracking-wider text-text-muted">Privacy Filters</span>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="text-sm font-bold text-white">Visible on Radar</h5>
                          <p className="text-[11px] text-text-secondary mt-0.5">Allow other users in your city to discover your bubble.</p>
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
                          const generatedAvatar = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${gender}-${alias}`;
                          socket.emit('register-user', {
                            userId,
                            alias,
                            realName: realName.trim() || alias.trim(),
                            avatarUrl: generatedAvatar,
                            interests: selectedTags,
                            age: finalAge,
                            gender,
                            genderPreference,
                            city: selectedCity,
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

                    <div className="flex justify-center mt-1">
                      <button 
                        onClick={() => setShowTermsModal(true)}
                        className="text-xs text-violet-400 font-semibold hover:underline bg-transparent border-none p-0 cursor-pointer"
                        style={{ textTransform: 'none' }}
                      >
                        Terms of Service & Privacy Policy
                      </button>
                    </div>

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

                {/* Chat Header */}
                <div className="pb-4 flex items-center justify-between border-b border-white/5 bg-transparent">
                  <div className="flex items-center gap-2 min-w-0">
                    <button 
                      onClick={() => { 
                        setActiveConnectionId(null); 
                        setActivePartner(null); 
                        setShowChatMenu(false);
                      }}
                      className="p-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all flex items-center justify-center flex-shrink-0"
                      title="Exit Room"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>

                    <div className="w-9 h-9 rounded-full border border-white/10 overflow-hidden relative bg-white/5 flex-shrink-0">
                      <img 
                        src={activePartner?.avatarUrl || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${activePartner?.alias}`} 
                        alt="Avatar" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex items-center gap-1.5">
                      <h4 className="font-bold text-white text-xs md:text-sm truncate">@{activePartner?.alias}</h4>
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" title="Online"></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Game selector trigger */}
                    <div className="relative flex items-center">
                      <button
                        onClick={() => {
                          setShowGameSelector(!showGameSelector);
                          setShowChatMenu(false);
                        }}
                        className="p-2 rounded-lg bg-violet-600/10 border border-violet-500/20 text-violet-400 hover:bg-violet-600/20 hover:text-violet-300 transition-all flex items-center justify-center"
                        title="Play Games"
                      >
                        <Gamepad2 className="w-4 h-4" />
                      </button>

                      {showGameSelector && (
                        <div className="chat-dropdown-menu right-0 mt-1" style={{ top: '100%', right: 0 }}>
                          <button
                            onClick={() => handleStartGame('tictactoe')}
                            className="chat-dropdown-item font-semibold flex items-center gap-2 hover:bg-violet-950/30 text-white"
                          >
                            🕹️ Tic Tac Toe
                          </button>
                          <button
                            onClick={() => handleStartGame('drawguess')}
                            className="chat-dropdown-item font-semibold flex items-center gap-2 hover:bg-violet-950/30 text-white"
                          >
                            🎨 Draw & Guess
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="relative flex items-center">
                      <button
                        onClick={() => {
                          setShowChatMenu(!showChatMenu);
                          setShowGameSelector(false);
                        }}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
                        title="Chat Options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {showChatMenu && (
                        <div className="chat-dropdown-menu">
                          <button
                            onClick={() => {
                              if (activeConnectionId) {
                                handleSafetyAction('delete', activeConnectionId);
                              }
                              setShowChatMenu(false);
                            }}
                            className="chat-dropdown-item delete"
                          >
                            Delete Chat
                          </button>
                          <button
                            onClick={() => {
                              if (activeConnectionId) {
                                handleSafetyAction('block', activeConnectionId);
                              }
                              setShowChatMenu(false);
                            }}
                            className="chat-dropdown-item block"
                          >
                            Block User
                          </button>
                          <button
                            onClick={() => {
                              if (activeConnectionId) {
                                handleSafetyAction('report', activeConnectionId);
                              }
                              setShowChatMenu(false);
                            }}
                            className="chat-dropdown-item report"
                          >
                            Report User
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Chat History Panel */}
                <div className="chat-history-container">
                  <div className="mx-auto my-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[11px] text-text-muted text-center max-w-md" style={{ textTransform: 'none' }}>
                    🔒 This anonymous conversation is ephemeral. If you close the app or disconnect for over 1 minute, the chat will be permanently erased.
                  </div>
                  {chatMessages.map((msg) => {
                    const isMe = msg.senderId === userId;
                    return (
                      <div
                        key={msg.id}
                        className={`message-bubble ${isMe ? 'message-sent' : 'message-received'}`}
                      >
                        <div>{sanitizeText(msg.text)}</div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

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

                {/* --- GAME OVERLAYS --- */}

                {/* Tic Tac Toe Game Overlay */}
                {activeGame === 'tictactoe' && (
                  <div className="game-overlay animate-fadeIn">
                    {/* Game Scoreboard Header */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4 w-full">
                      {/* Left Player: Me */}
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full border border-violet-500/20 overflow-hidden bg-white/5 flex items-center justify-center">
                          <img src={avatarUrl || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${alias}`} alt="Me" className="w-full h-full" />
                        </div>
                        <div className="text-left">
                          <h5 className="text-xs font-bold text-violet-400">@You (X)</h5>
                          <span className="text-[10px] text-text-secondary">{gameScores[userId] || 0} pts</span>
                        </div>
                      </div>

                      {/* Middle Status / controls */}
                      <div className="text-center">
                        <span className="text-xs uppercase font-extrabold tracking-widest text-violet-300">Tic Tac Toe</span>
                        <p className="text-[10px] text-cyan-400 font-semibold mt-0.5">
                          {tttWinner ? (
                            tttWinner === 'draw' ? "It's a draw!" : tttWinner === userId ? "🎉 You Won!" : `🎉 @${activePartner?.alias} Won!`
                          ) : (
                            tttTurn === userId ? "👉 Your turn" : `Waiting for @${activePartner?.alias}...`
                          )}
                        </p>
                      </div>

                      {/* Right Player: Partner */}
                      <div className="flex items-center gap-2 text-right justify-end">
                        <div className="text-right">
                          <h5 className="text-xs font-bold text-cyan-400">@{activePartner?.alias} (O)</h5>
                          <span className="text-[10px] text-text-secondary">{gameScores[activePartner?.id || ''] || 0} pts</span>
                        </div>
                        <div className="w-8 h-8 rounded-full border border-cyan-500/20 overflow-hidden bg-white/5 flex items-center justify-center">
                          <img src={activePartner?.avatarUrl || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${activePartner?.alias}`} alt="Partner" className="w-full h-full" />
                        </div>
                      </div>
                    </div>

                    {/* Tic Tac Toe Grid Board */}
                    <div className="flex-1 flex flex-col justify-center items-center">
                      <div className="tictactoe-grid">
                        {tttBoard.map((cell, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleTttCellClick(idx)}
                            className={`tictactoe-cell ${cell === 'X' ? 'token-x' : cell === 'O' ? 'token-o' : ''}`}
                            disabled={!!tttWinner}
                          >
                            {cell}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Action buttons footer */}
                    <div className="flex justify-center gap-3 pt-3 mt-4 w-full">
                      {tttWinner && (
                        <button 
                          onClick={handleTttReset}
                          className="btn-primary py-2 px-6 text-xs"
                        >
                          Play Again
                        </button>
                      )}
                      <button 
                        onClick={handleExitGame}
                        className="game-btn-secondary py-2 px-6 text-xs"
                      >
                        Exit Game
                      </button>
                    </div>
                  </div>
                )}

                {/* Draw & Guess Game Overlay */}
                {activeGame === 'drawguess' && (
                  <div className="game-overlay animate-fadeIn">
                    {/* Game Scoreboard Header */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 w-full">
                      {/* Left Player: Me */}
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full border border-violet-500/20 overflow-hidden bg-white/5 flex items-center justify-center">
                          <img src={avatarUrl || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${alias}`} alt="Me" className="w-full h-full" />
                        </div>
                        <div className="text-left">
                          <h5 className="text-xs font-bold text-violet-400">@You</h5>
                          <span className="text-[10px] text-text-secondary">{gameScores[userId] || 0} pts</span>
                        </div>
                      </div>

                      {/* Middle Status */}
                      <div className="text-center">
                        <span className="text-xs uppercase font-extrabold tracking-widest text-violet-300">Draw & Guess</span>
                        <p className="text-[10px] text-cyan-400 font-semibold mt-0.5">
                          {dgDrawerId === userId ? (
                            <span className="text-emerald-400 animate-pulse">🖌️ You are drawing!</span>
                          ) : (
                            <span className="text-cyan-400">👀 Guess the drawing!</span>
                          )}
                        </p>
                      </div>

                      {/* Right Player: Partner */}
                      <div className="flex items-center gap-2 text-right justify-end">
                        <div className="text-right">
                          <h5 className="text-xs font-bold text-cyan-400">@{activePartner?.alias}</h5>
                          <span className="text-[10px] text-text-secondary">{gameScores[activePartner?.id || ''] || 0} pts</span>
                        </div>
                        <div className="w-8 h-8 rounded-full border border-cyan-500/20 overflow-hidden bg-white/5 flex items-center justify-center">
                          <img src={activePartner?.avatarUrl || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${activePartner?.alias}`} alt="Partner" className="w-full h-full" />
                        </div>
                      </div>
                    </div>

                    {/* Round Instructions banner / Word display */}
                    <div className="glass-panel py-2 px-4 rounded-xl border-white/5 flex justify-between items-center w-full mb-3 bg-white/5">
                      {dgDrawerId === userId ? (
                        <>
                          <span className="text-[10px] text-text-secondary uppercase font-bold">Secret Word to Draw:</span>
                          <span className="text-sm font-extrabold text-emerald-400 tracking-wider font-space uppercase">{dgWord}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] text-text-secondary uppercase font-bold">Word Hint:</span>
                          <span className="text-sm font-extrabold text-cyan-400 tracking-widest font-space uppercase">{dgHint}</span>
                        </>
                      )}
                    </div>

                    {/* Draw and Guess Canvas Section */}
                    <div className="flex-1 flex flex-col justify-center items-center relative w-full overflow-hidden">
                      {/* Celebration overlay */}
                      {dgCelebration && (
                        <div className="absolute inset-0 z-50 bg-black/85 flex flex-col justify-center items-center text-center p-4 animate-scaleUp">
                          <span className="text-5xl mb-2 animate-bounce">🎉</span>
                          <h4 className="font-extrabold text-white text-base">{dgCelebration.winnerAlias} Guessed It!</h4>
                          <p className="text-xs text-violet-300 mt-1 font-semibold">The word was: <span className="text-emerald-400 uppercase font-mono tracking-wider font-extrabold">{dgCelebration.word}</span></p>
                          <span className="text-[10px] text-text-muted mt-3 animate-pulse">Starting next round...</span>
                        </div>
                      )}

                      {/* Canvas */}
                      <div className="canvas-wrapper relative bg-white/5 rounded-2xl border border-white/10 overflow-hidden shadow-inner">
                        {dgIncorrectGuess && dgDrawerId === userId && (
                          <div className="absolute top-3 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white text-[11px] font-bold py-1.5 px-4 rounded-full shadow-lg border border-red-400/30 animate-shake">
                            Partner guessed: "{dgIncorrectGuess}"
                          </div>
                        )}
                        <canvas
                          ref={canvasRef}
                          width={500}
                          height={350}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                          className={`bg-[#0c081e]/40 ${dgDrawerId === userId ? 'cursor-crosshair' : 'pointer-events-none'}`}
                        />
                      </div>

                      {/* Drawer Color Palette & Toolbar */}
                      {dgDrawerId === userId && (
                        <div className="flex items-center gap-3 mt-3 justify-center w-full px-2">
                          {/* Colors */}
                          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full p-1">
                            {['#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ffffff'].map(c => (
                              <button
                                key={c}
                                onClick={() => setDrawColor(c)}
                                style={{ backgroundColor: c }}
                                className={`w-5 h-5 rounded-full border ${drawColor === c ? 'border-white scale-125 shadow-lg' : 'border-white/10'}`}
                              />
                            ))}
                          </div>

                          {/* Sizes */}
                          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-xs">
                            <span className="text-[10px] text-text-secondary">Brush:</span>
                            <input 
                              type="range" 
                              min={1} 
                              max={15} 
                              value={brushSize} 
                              onChange={e => setBrushSize(parseInt(e.target.value))}
                              className="w-16 h-1 rounded-lg accent-violet-500 cursor-pointer"
                            />
                          </div>

                          <button
                            onClick={clearCanvas}
                            className="game-btn-secondary py-1 px-3 w-auto text-[10px]"
                            style={{ padding: '6px 12px' }}
                          >
                            Clear
                          </button>
                        </div>
                      )}

                      {/* Guesser Input */}
                      {dgDrawerId !== userId && (
                        <form onSubmit={handleSendGuess} className="flex gap-2 mt-4 w-full max-w-sm px-2">
                          <input
                            type="text"
                            value={dgGuessInput}
                            onChange={e => setDgGuessInput(e.target.value.replace(/[^a-zA-Z]/g, ''))}
                            placeholder="Type your guess here..."
                            className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-violet-500 transition-all text-xs"
                          />
                          <button
                            type="submit"
                            disabled={!dgGuessInput.trim()}
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl text-xs transition-all"
                          >
                            Guess
                          </button>
                        </form>
                      )}
                    </div>

                    {/* Exit Game Footer */}
                    <div className="flex justify-center gap-3 pt-3 mt-3 w-full">
                      <button 
                        onClick={handleExitGame}
                        className="game-btn-secondary py-2 px-6 text-xs"
                      >
                        Exit Game
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* C. Recent Connections bottom deck */}
          {!activeConnectionId && (
            <div className="recent-connections-section">
              <div className="deck-header">
                <h4>Recent Connections</h4>
                <button onClick={() => showToast('Connection history is available in the Chats tab.', 'info')} className="text-xs text-violet-400 font-semibold hover:underline">View all</button>
              </div>
              
              <div className="deck-cards">
                {activeConnections.length === 0 ? (
                  <div className="deck-placeholder">
                    No active connections yet. Search for users and wave to open a thread!
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
                          src={c.avatarUrl || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${c.partnerAlias}`} 
                          alt="Avatar" 
                        />
                        {c.isOnline && <div className="active-dot"></div>}
                      </div>
                      <h5>@{c.partnerAlias}</h5>
                      <p className="text-[10px] text-text-muted mt-0.5">{c.time}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </section>

        {/* ================= COLUMN 3: RIGHT SIDEBAR ================= */}
        {!(isRegistered && activeTab === 'home' && !activeConnectionId) && (
          <aside className="sidebar-right">
          <div className="right-header">
            {/* Server status dot */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-semibold">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`}></div>
              <span className="text-text-secondary">{isConnected ? 'Server Live' : 'Connecting'}</span>
            </div>

            <div className="relative">
              <button 
                className={`bell-btn ${notifications.length > 0 ? 'has-notifications' : ''}`} 
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="bell-badge-dot"></span>
                )}
              </button>
              {renderNotificationDropdown()}
            </div>
            
            {/* User Info dropdown slot */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setActiveTab('settings'); setActiveConnectionId(null); }} title="Click to view and edit profile settings">
              <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden bg-white/5 relative flex items-center justify-center">
                <img src={avatarUrl || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${alias}`} alt="Avatar" className="w-full h-full object-cover" />
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
                <p>We match you with people active in the same city.</p>
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
                <p>Talk, connect, and enjoy conversations.</p>
              </div>
            </div>

            <div className="timeline-step">
              <div className="timeline-icon">
                <Gamepad2 className="w-4 h-4" />
              </div>
              <div className="timeline-content">
                <h5>Play interactive games</h5>
                <p>Play Tic Tac Toe or Draw & Guess inside chats.</p>
              </div>
            </div>
          </div>




        </aside>
        )}

      </div>



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
                  <h5>City-Wide Matching</h5>
                  <p>We check for active matches within your chosen city. Your coordinates are never stored or shared with anyone, and we add an organic jitter offset to keep your location private.</p>
                </div>
              </div>

              <div className="modal-list-item">
                <div className="modal-list-number">3</div>
                <div className="modal-list-content">
                  <h5>Full Control</h5>
                  <p>Your identity is never automatically revealed. You choose what to share and when you want to share it directly in chat.</p>
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

      {/* Terms of Service & Privacy Policy Modal */}
      {showTermsModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div className="modal-header-icon">
                <ShieldAlert className="w-5 h-5 text-violet-400" />
              </div>
              <div className="modal-header-info">
                <h4>Terms of Service & Privacy Policy</h4>
                <p>User-Generated Content (UGC) Guidelines</p>
              </div>
            </div>

            <div className="modal-divider" />

            <div className="modal-list" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '6px' }}>
              <div className="modal-list-item">
                <div className="modal-list-number">1</div>
                <div className="modal-list-content">
                  <h5>Zero Tolerance for Abuse</h5>
                  <p>InstantMeet enforces a strict zero-tolerance policy towards objectionable content or abusive/harassing behaviors. Bullying, hate speech, harassment, threats, explicit sexuality, or graphical violence will result in an immediate and permanent account suspension.</p>
                </div>
              </div>

              <div className="modal-list-item">
                <div className="modal-list-number">2</div>
                <div className="modal-list-content">
                  <h5>Community Guidelines</h5>
                  <p>Your anonymity is protected, but anonymity is not a shield for misconduct. All users must communicate respectfully. Any fraudulent activity, scamming, or violation of safety guidelines is prohibited.</p>
                </div>
              </div>

              <div className="modal-list-item">
                <div className="modal-list-number">3</div>
                <div className="modal-list-content">
                  <h5>Report & Block Actions</h5>
                  <p>We provide instant safety controls. You can tap the Shield/Safety icon at any time on a user's profile card or inside a chat room to delete the connection, block them, or report their behavior immediately.</p>
                </div>
              </div>

              <div className="modal-list-item">
                <div className="modal-list-number">4</div>
                <div className="modal-list-content">
                  <h5>Moderation & Enforcement</h5>
                  <p>Accumulating three (3) or more flags/reports from unique users will automatically trigger a permanent ban. Our administrators actively moderate reported content, dismiss reports, or manually issue bans when appropriate.</p>
                </div>
              </div>

              <div className="modal-list-item">
                <div className="modal-list-number">5</div>
                <div className="modal-list-content">
                  <h5>Indian Law Compliance & Grievance</h5>
                  <p>In accordance with the Information Technology (IT) Rules, 2021 and DPDP Act, 2023, your city matching details are encrypted and never shared. To report legal content violations or reach our Grievance Officer, contact support@instantmeet.com.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowTermsModal(false)}
              className="modal-close-btn"
            >
              I Accept & Agree
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

      {/* Drop Modal (Voice/Message Drop creation modal) */}
      {isDropModalOpen && (
        <div className="modal-overlay">
          <div className="glass-panel modal-card border-violet-500/20" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <div className="modal-header-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', color: '#a855f7' }}>
                <MapPin className="w-5 h-5 text-violet-400" />
              </div>
              <div className="modal-header-info">
                <h4>Drop a Message or Voice Note 📍</h4>
                <p>Pin it in the deep space of {selectedCity}</p>
              </div>
            </div>

            <div className="modal-divider" />

            {/* Feature Description Card */}
            <div 
              style={{
                background: 'rgba(139, 92, 246, 0.04)',
                border: '1px dashed rgba(139, 92, 246, 0.25)',
                borderRadius: '12px',
                padding: '10px 12px',
                marginBottom: '16px'
              }}
              className="animate-fadeIn"
            >
              <p className="text-[11px] leading-relaxed text-violet-300 text-center" style={{ textTransform: 'none', margin: 0 }}>
                <strong>How it works:</strong> Create a voice note or short message and pin it in your city. Other local users can find it floating on their radar, listen to it, and request to connect. Once you accept their wave, a secure chat room opens!
              </p>
              <p className="text-[10px] leading-relaxed text-amber-300/90 text-center mt-2 animate-pulse" style={{ textTransform: 'none', margin: '6px 0 0 0' }}>
                ⚠️ <strong>Note:</strong> Closing the app deletes your drops and active chats after 1 minute of absence.
              </p>
            </div>

            {/* Tab selector */}
            <div className="flex gap-2 mb-4 w-full" style={{ display: 'flex', gap: '8px', marginBottom: '16px', width: '100%' }}>
              <button
                type="button"
                onClick={() => setDropType('voice')}
                disabled={isRecording || isUploading}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  dropType === 'voice'
                    ? 'bg-violet-600 border border-violet-500 text-white shadow-md shadow-violet-600/20'
                    : 'bg-white/5 border border-white/10 text-violet-300 hover:bg-white/10'
                }`}
                style={{ height: '38px', padding: '0 12px', flex: 1, cursor: 'pointer' }}
              >
                🎤 Voice Drop
              </button>
              <button
                type="button"
                onClick={() => setDropType('message')}
                disabled={isRecording || isUploading}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  dropType === 'message'
                    ? 'bg-violet-600 border border-violet-500 text-white shadow-md shadow-violet-600/20'
                    : 'bg-white/5 border border-white/10 text-violet-300 hover:bg-white/10'
                }`}
                style={{ height: '38px', padding: '0 12px', flex: 1, cursor: 'pointer' }}
              >
                ✉️ Message Drop
              </button>
            </div>

            {dropType === 'voice' ? (
              <div className="flex flex-col items-center gap-4 w-full" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%', marginBottom: '20px' }}>
                <div className="w-20 h-20 rounded-full flex items-center justify-center border relative transition-all duration-300" style={{
                  background: isRecording ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  borderColor: isRecording ? '#ef4444' : 'rgba(255, 255, 255, 0.1)',
                  boxShadow: isRecording ? '0 0 20px rgba(239, 68, 68, 0.4)' : 'none'
                }}>
                  {isRecording ? (
                    <div className="w-10 h-10 rounded-full bg-red-500 animate-pulse flex items-center justify-center text-white">
                      ⏹️
                    </div>
                  ) : (
                    <span className="text-3xl">🎤</span>
                  )}
                </div>

                <div className="text-center">
                  {isRecording ? (
                    <p className="text-xs text-red-400 font-bold animate-pulse">
                      Recording: {recordingSeconds}s / 60s
                    </p>
                  ) : audioBlob ? (
                    <p className="text-xs text-emerald-400 font-semibold">
                      Voice Note Recorded ({audioDuration}s)
                    </p>
                  ) : (
                    <p className="text-xs text-text-secondary">
                      Max duration: 1 minute
                    </p>
                  )}
                </div>

                <div className="flex gap-2 w-full" style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  {!audioBlob ? (
                    <button
                      type="button"
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isUploading}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        isRecording 
                          ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/10' 
                          : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/15'
                      }`}
                      style={{ height: '40px', flex: 1, cursor: 'pointer' }}
                    >
                      {isRecording ? 'Stop Recording' : 'Start Recording'}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={togglePreviewPlayback}
                        className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                          isPreviewPlaying
                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                            : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                        }`}
                        style={{ height: '40px', flex: 1, cursor: 'pointer' }}
                      >
                        {isPreviewPlaying ? '⏹️ Pause' : '▶️ Play Preview'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAudioBlob(null);
                          setAudioDuration(0);
                          setRecordingSeconds(0);
                          if (previewPlayerRef.current) previewPlayerRef.current.pause();
                          setIsPreviewPlaying(false);
                        }}
                        disabled={isUploading}
                        className="py-2.5 rounded-xl text-xs font-bold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                        style={{ height: '40px', flex: 1, cursor: 'pointer' }}
                      >
                        🗑️ Reset
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 w-full" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginBottom: '20px' }}>
                <label className="text-[10px] text-text-secondary uppercase tracking-wider font-bold">Write a Message</label>
                <textarea
                  value={dropMessageText}
                  onChange={(e) => setDropMessageText(e.target.value.slice(0, 140))}
                  placeholder="Drop a thought, question, or vibe..."
                  disabled={isUploading}
                  className="w-full h-24 p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-text-muted focus:border-violet-500/40 focus:outline-none resize-none transition-all"
                  style={{ textTransform: 'none' }}
                />
                <div className="flex justify-end">
                  <span className={`text-[10px] ${dropMessageText.length >= 130 ? 'text-amber-400 font-bold' : 'text-text-muted'}`}>
                    {dropMessageText.length}/140
                  </span>
                </div>
              </div>
            )}

            <div className="modal-divider" />

            <div className="flex gap-2.5 w-full" style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button
                type="button"
                onClick={handlePublishDrop}
                disabled={isUploading || isRecording || (dropType === 'voice' && !audioBlob) || (dropType === 'message' && !dropMessageText.trim())}
                className="btn-primary py-2.5 px-4 text-xs font-bold tracking-wider flex-1 shadow-lg shadow-violet-500/20 disabled:opacity-40 disabled:pointer-events-none"
                style={{ flex: 1, padding: '12px' }}
              >
                {isUploading ? 'Publishing...' : 'Publish Drop 📍'}
              </button>
              <button
                type="button"
                onClick={closeDropModal}
                disabled={isUploading}
                className="change-location-btn py-2.5 px-4 text-xs font-bold flex-1"
                style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
              >
                Cancel
              </button>
            </div>
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
