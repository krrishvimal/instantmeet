export interface Location {
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  alias: string;
  realName: string;
  avatarUrl: string;
  interests: string[];
  age: number;
  gender: string;
  genderPreference: string;
  city: string;
  location: Location;
  lastActive: number;
  socketId?: string;
  isOnline: boolean;
  isVisible: boolean;
  stealthMode: boolean;
  subscribedCityAlerts?: string;
}

export interface Connection {
  id: string;
  user1Id: string;
  user2Id: string;
  status: 'anonymous' | 'revealed' | 'blocked';
  user1Reveal: boolean;
  user2Reveal: boolean;
  messages: Message[];
  createdAt: number;
}

export interface Message {
  id: string;
  connectionId: string;
  senderId: string;
  senderAlias: string;
  text: string;
  timestamp: number;
}

export interface SearchResult {
  userId: string;
  alias: string;
  interests: string[];
  age: number;
  gender: string;
  distanceKm: number;
  isOnline: boolean;
  city?: string;
}

export interface Drop {
  id: string;
  userId: string;
  type: 'voice' | 'message';
  contentUrl?: string;
  messageText?: string;
  duration?: number;
  city: string;
  location: Location;
  status: 'active' | 'accepted';
  createdAt: number;
}
