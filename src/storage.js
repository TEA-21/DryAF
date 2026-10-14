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

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';

const STORAGE_PREFIX = 'waterkeg_room_';
const SESSION_KEY = 'waterkeg_session_v2';

export const FIREBASE_CONFIG = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dryaf-oasis-65def",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:121859009077:web:f71fa9747e08bd86449f7c",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dryaf-oasis-65def.firebasestorage.app",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dryaf-oasis-65def.firebaseapp.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "121859009077"
};

export const DEFAULT_ROOMMATES = [
  { id: 'usr-1', name: 'Alex', avatar: '☕', lastFilledAt: new Date(Date.now() - 5 * 86400000).toISOString(), totalFills: 2, status: 'active' },
  { id: 'usr-2', name: 'Jordan', avatar: '🎧', lastFilledAt: new Date(Date.now() - 3 * 86400000).toISOString(), totalFills: 4, status: 'active' },
  { id: 'usr-3', name: 'Taylor', avatar: '🌱', lastFilledAt: new Date(Date.now() - 1 * 86400000).toISOString(), totalFills: 5, status: 'active' },
  { id: 'usr-4', name: 'Sam', avatar: '⚡', lastFilledAt: null, totalFills: 0, status: 'active' },
];

export function createDefaultRoomState(hostelBlock = 'Block B', roomNumber = '304', creatorName = 'Wastelander', creatorExtra = {}) {
  const cleanBlock = hostelBlock.trim();
  const cleanRoom = roomNumber.trim();
  // Standard room code format e.g. "B-304" or "H4-201"
  const blockShort = cleanBlock.replace(/^Block\s*/i, '').replace(/^Hostel\s*/i, 'H');
  const roomCode = `${blockShort}-${cleanRoom}`.toUpperCase();

  const creator = {
    id: creatorExtra.id || `usr-${Date.now()}`,
    name: creatorName.trim(),
    avatar: creatorExtra.avatar || '👤',
    photoUrl: creatorExtra.photoUrl || null,
    email: creatorExtra.email || null,
    googleUid: creatorExtra.googleUid || null,
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
    roommates: [creator],
    refillLogs: [],
    wheelState: null
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
  wheelState: null,
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

  static setSession(roomCode, userId, userName, googleData = null) {
    try {
      const session = { roomCode, userId, userName };
      if (googleData) {
        session.googleUid = googleData.uid || googleData.googleUid || null;
        session.email = googleData.email || null;
        session.photoURL = googleData.photoURL || googleData.photoUrl || null;
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
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

export class AuthManager {
  static auth = null;

  static init(firebaseApp) {
    if (!this.auth && firebaseApp) {
      try {
        this.auth = getAuth(firebaseApp);
      } catch (err) {
        console.warn('Firebase Auth initialization error:', err);
      }
    }
    return this.auth;
  }

  static getAuthInstance() {
    if (!this.auth) {
      const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
      this.init(app);
    }
    return this.auth;
  }

  static getCurrentUser() {
    const auth = this.getAuthInstance();
    if (auth && auth.currentUser) {
      const u = auth.currentUser;
      return {
        uid: u.uid,
        displayName: u.displayName || 'Google Wastelander',
        email: u.email,
        photoURL: u.photoURL
      };
    }
    return null;
  }

  static async signInWithGoogle() {
    const auth = this.getAuthInstance();
    if (!auth) throw new Error('Firebase Auth is not available.');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    return {
      uid: user.uid,
      displayName: user.displayName || 'Google Wastelander',
      email: user.email,
      photoURL: user.photoURL
    };
  }

  static async signOutGoogle() {
    const auth = this.getAuthInstance();
    if (auth) {
      await signOut(auth);
    }
  }

  static onAuthStateChanged(callback) {
    const auth = this.getAuthInstance();
    if (auth) {
      return onAuthStateChanged(auth, (user) => {
        if (user) {
          callback({
            uid: user.uid,
            displayName: user.displayName || 'Google Wastelander',
            email: user.email,
            photoURL: user.photoURL
          });
        } else {
          callback(null);
        }
      });
    }
    return () => {};
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
    this.currentRoomCode = null;

    this.initBroadcastChannel();
    this.initFirebase();
  }

  initFirebase() {
    try {
      if (!getApps().length) {
        this.firebaseApp = initializeApp(FIREBASE_CONFIG);
      } else {
        this.firebaseApp = getApps()[0];
      }
      this.firestore = getFirestore(this.firebaseApp);
      AuthManager.init(this.firebaseApp);
      this.isCloudConnected = true;
      console.log('Firebase Firestore and Auth initialized successfully.');
    } catch (e) {
      console.warn('Firebase initialization error, running in local-only fallback mode:', e);
      this.isCloudConnected = false;
    }
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
    const cleanCode = roomCode.toUpperCase();
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + cleanCode);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load room state from local storage:', e);
    }

    // Default demo room fallback only for explicit DEMO-OASIS
    if (cleanCode === 'DEMO-OASIS') {
      return { ...DEMO_ROOM_STATE, roomCode: cleanCode };
    }

    return null;
  }

  async fetchRoomState(roomCode) {
    if (!roomCode) return null;
    const cleanCode = roomCode.toUpperCase();

    // 1. Check Cloud Firestore first if online
    if (this.firestore && this.isCloudConnected) {
      try {
        const roomDocRef = doc(this.firestore, 'rooms', cleanCode);
        const snap = await getDoc(roomDocRef);
        if (snap.exists()) {
          const cloudData = snap.data();
          if (cloudData && Array.isArray(cloudData.roommates)) {
            // Save to local cache
            try {
              localStorage.setItem(STORAGE_PREFIX + cleanCode, JSON.stringify(cloudData));
            } catch {
              // Ignore
            }
            return cloudData;
          }
        }
      } catch (e) {
        console.warn('Firestore fetch failed, checking local cache:', e);
      }
    }

    // 2. Fallback to local storage or demo room
    return this.loadRoomState(cleanCode);
  }

  saveRoomState(state) {
    if (!state || !state.roomCode) return;
    const cleanCode = state.roomCode.toUpperCase();
    try {
      localStorage.setItem(STORAGE_PREFIX + cleanCode, JSON.stringify(state));
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage(state);
      }
    } catch (e) {
      console.warn('Failed to save room state to local storage:', e);
    }
  }

  subscribeToRoom(roomCode) {
    if (!roomCode) return;
    const cleanCode = roomCode.toUpperCase();
    if (this.currentRoomCode === cleanCode && this.unsubscribeFirestore) {
      return; // Already listening
    }
    this.currentRoomCode = cleanCode;

    if (!this.firestore || !this.isCloudConnected) return;

    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore();
      this.unsubscribeFirestore = null;
    }

    try {
      const roomDocRef = doc(this.firestore, 'rooms', cleanCode);
      this.unsubscribeFirestore = onSnapshot(roomDocRef, (snap) => {
        if (snap.exists()) {
          const remoteData = snap.data();
          if (remoteData && Array.isArray(remoteData.roommates)) {
            // Update local storage cache
            try {
              localStorage.setItem(STORAGE_PREFIX + cleanCode, JSON.stringify(remoteData));
            } catch {
              // Ignore
            }
            if (this.onRemoteUpdate) {
              this.onRemoteUpdate(remoteData);
            }
          }
        }
      }, (err) => {
        console.warn('Firestore real-time subscription error:', err);
      });
    } catch (e) {
      console.warn('Firestore subscription setup failed:', e);
    }
  }

  unsubscribe() {
    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore();
      this.unsubscribeFirestore = null;
    }
    this.currentRoomCode = null;
  }

  async syncState(state) {
    if (!state || !state.roomCode) return;
    const cleanCode = state.roomCode.toUpperCase();

    // 1. Always update local storage & broadcast channel immediately
    this.saveRoomState(state);

    // 2. Sync to Cloud Firestore
    if (this.firestore && this.isCloudConnected) {
      try {
        const roomDocRef = doc(this.firestore, 'rooms', cleanCode);

        // Sanitize refillLogs to keep document size under Firestore's 1MB limit:
        // Keep most recent 15 logs, and ensure thumbnail photos are not gigantic.
        const sanitizedLogs = (state.refillLogs || []).slice(0, 15).map(log => {
          let photoUrl = log.photoUrl || null;
          if (typeof photoUrl === 'string' && photoUrl.length > 80000) {
            photoUrl = null;
          }
          return {
            id: log.id,
            roommateId: log.roommateId,
            roommateName: log.roommateName,
            avatar: log.avatar || '👤',
            timestamp: log.timestamp,
            waterLevelDetected: log.waterLevelDetected || 100,
            confidence: log.confidence || 95,
            verified: log.verified !== false,
            reported: !!log.reported,
            reportedBy: log.reportedBy || null,
            reportedAt: log.reportedAt || null,
            reports: Array.isArray(log.reports) ? log.reports.slice(0, 10).map(r => ({
              userId: r.userId || '',
              userName: r.userName || 'Anonymous Roommate',
              timestamp: r.timestamp || new Date().toISOString()
            })) : [],
            penaltyApplied: typeof log.penaltyApplied === 'number' ? log.penaltyApplied : 0,
            photoUrl
          };
        });

        const cloudPayload = {
          roomCode: cleanCode,
          hostelBlock: state.hostelBlock || 'Block B',
          roomNumber: state.roomNumber || '304',
          kegStatus: state.kegStatus || 'full',
          lastFilledAt: state.lastFilledAt || null,
          lastFilledBy: state.lastFilledBy || null,
          lastEmptiedAt: state.lastEmptiedAt || null,
          lastEmptiedBy: state.lastEmptiedBy || null,
          roommates: (state.roommates || []).map(r => ({
            id: r.id,
            name: r.name,
            avatar: r.avatar || '👤',
            photoUrl: r.photoUrl || null,
            email: r.email || null,
            googleUid: r.googleUid || null,
            lastFilledAt: r.lastFilledAt || null,
            totalFills: typeof r.totalFills === 'number' ? r.totalFills : 0,
            status: r.status || 'active',
            penalties: typeof r.penalties === 'number' ? r.penalties : 0
          })),
          refillLogs: sanitizedLogs,
          wheelState: state.wheelState ? {
            id: state.wheelState.id,
            kegEmptiedAt: state.wheelState.kegEmptiedAt || null,
            candidateIds: Array.isArray(state.wheelState.candidateIds) ? state.wheelState.candidateIds : [],
            agreedUserIds: Array.isArray(state.wheelState.agreedUserIds) ? state.wheelState.agreedUserIds : [],
            status: state.wheelState.status || 'waiting_for_agreements',
            countdownStartedAt: state.wheelState.countdownStartedAt || null,
            spunAt: state.wheelState.spunAt || null,
            winnerId: state.wheelState.winnerId || null,
            targetAngle: typeof state.wheelState.targetAngle === 'number' ? state.wheelState.targetAngle : null
          } : null
        };

        await setDoc(roomDocRef, cloudPayload, { merge: true });
      } catch (e) {
        console.warn('Firestore sync failed, local state preserved:', e);
      }
    }
  }
}

