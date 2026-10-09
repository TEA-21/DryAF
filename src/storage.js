/**
 * Storage and Real-Time Synchronization Layer
 * 
 * Manages:
 * 1. Room state (Hostel Block & Room Number).
 * 2. Roommate identities and refill logs.
 * 3. Reporting/disputing refill logs and adjusting fill counts.
 * 4. User session storage (remembers room & name).
 * 5. LocalStorage + BroadcastChannel multi-tab sync.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';

const STORAGE_PREFIX = 'waterkeg_room_';
const SESSION_KEY = 'waterkeg_session_v2';
const FIREBASE_CONFIG_KEY = 'waterkeg_firebase_config_v1';

export const DEFAULT_ROOMMATES = [
  { id: 'usr-1', name: 'Alex', avatar: '☕', lastFilledAt: new Date(Date.now() - 5 * 86400000).toISOString(), totalFills: 2, status: 'active' },
  { id: 'usr-2', name: 'Jordan', avatar: '🎧', lastFilledAt: new Date(Date.now() - 3 * 86400000).toISOString(), totalFills: 4, status: 'active' },
  { id: 'usr-3', name: 'Taylor', avatar: '🌱', lastFilledAt: new Date(Date.now() - 1 * 86400000).toISOString(), totalFills: 5, status: 'active' },
  { id: 'usr-4', name: 'Sam', avatar: '⚡', lastFilledAt: null, totalFills: 0, status: 'active' },
];

export function createDefaultRoomState(hostelBlock = 'Block B', roomNumber = '304', creatorName = 'Alex') {
  const cleanBlock = hostelBlock.trim();
  const cleanRoom = roomNumber.trim();
  // Standard room code format e.g. "B-304" or "H4-201"
  const blockShort = cleanBlock.replace(/^Block\s*/i, '').replace(/^Hostel\s*/i, 'H');
  const roomCode = `${blockShort}-${cleanRoom}`.toUpperCase();

  const creator = {
    id: `usr-${Date.now()}`,
    name: creatorName.trim(),
    avatar: '👤',
    lastFilledAt: null,
    totalFills: 0,
    status: 'active'
  };

  return {
    roomCode,
    hostelBlock: cleanBlock,
    roomNumber: cleanRoom,
    kegStatus: 'full', // 'full' | 'empty'
    lastFilledAt: new Date().toISOString(),
    lastFilledBy: creatorName,
    lastEmptiedAt: null,
    lastEmptiedBy: null,
    currentUserId: creator.id,
    currentUserName: creator.name,
    roommates: [creator],
    refillLogs: []
  };
}

export const DEMO_ROOM_STATE = {
  roomCode: 'B-304',
  hostelBlock: 'Block B',
  roomNumber: '304',
  kegStatus: 'full',
  lastFilledAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  lastFilledBy: 'Taylor',
  lastEmptiedAt: null,
  lastEmptiedBy: null,
  currentUserId: 'usr-1',
  currentUserName: 'Alex',
  roommates: DEFAULT_ROOMMATES,
  refillLogs: [
    {
      id: 'log-1',
      roommateId: 'usr-3',
      roommateName: 'Taylor',
      timestamp: new Date(Date.now() - 1 * 86400000).toISOString(),
      waterLevelDetected: 94,
      confidence: 96,
      verified: true,
      reported: false,
      photoUrl: null
    },
    {
      id: 'log-2',
      roommateId: 'usr-2',
      roommateName: 'Jordan',
      timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
      waterLevelDetected: 91,
      confidence: 94,
      verified: true,
      reported: false,
      photoUrl: null
    }
  ]
};

export class SessionManager {
  static getSession() {
    try {
      const data = localStorage.getItem(SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  static setSession(roomCode, userId, userName) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, userId, userName }));
    } catch {
      // Ignore
    }
  }

  static clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignore
    }
  }
}

export class SyncManager {
  constructor(onRemoteUpdate) {
    this.onRemoteUpdate = onRemoteUpdate;
    this.broadcastChannel = null;
    this.firebaseApp = null;
    this.firestore = null;
    this.unsubscribeFirestore = null;
    this.isCloudConnected = false;

    this.initBroadcastChannel();
  }

  initBroadcastChannel() {
    try {
      if (window.BroadcastChannel) {
        this.broadcastChannel = new BroadcastChannel('waterkeg_sync_channel');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && this.onRemoteUpdate) {
            this.onRemoteUpdate(event.data);
          }
        };
      }
    } catch {
      // Ignore if not supported
    }
  }

  loadRoomState(roomCode) {
    if (!roomCode) return null;
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + roomCode.toUpperCase());
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load room state:', e);
    }

    // If default demo room
    if (roomCode.toUpperCase() === 'B-304' || roomCode.toUpperCase() === 'KEG-404') {
      return { ...DEMO_ROOM_STATE, roomCode: roomCode.toUpperCase() };
    }

    return null;
  }

  saveRoomState(state) {
    if (!state || !state.roomCode) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + state.roomCode.toUpperCase(), JSON.stringify(state));
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage(state);
      }
    } catch (e) {
      console.warn('Failed to save room state:', e);
    }
  }

  subscribeToRoom(roomCode) {
    // Cloud sync placeholder if Firebase is configured
    if (!this.firestore) return;
    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore();
    }

    try {
      const roomDocRef = doc(this.firestore, 'rooms', roomCode.toUpperCase());
      this.unsubscribeFirestore = onSnapshot(roomDocRef, (snap) => {
        if (snap.exists()) {
          const remoteData = snap.data();
          if (remoteData && this.onRemoteUpdate) {
            this.onRemoteUpdate(remoteData);
          }
        }
      });
    } catch {
      // Ignore
    }
  }

  async syncState(state) {
    this.saveRoomState(state);

    if (this.firestore && this.isCloudConnected && state && state.roomCode) {
      try {
        const roomDocRef = doc(this.firestore, 'rooms', state.roomCode.toUpperCase());
        await setDoc(roomDocRef, state, { merge: true });
      } catch {
        // Fallback to local
      }
    }
  }
}
