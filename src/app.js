/**
 * WaterKeg Application Controller
 * Manages Hostel Room access, locked-identity refill photo verification,
 * roommate turn order, dispute reporting, and photo previews.
 */

import confetti from 'canvas-confetti';
import { calculateLRUQueue, formatTimeAgo } from './lru.js';
import { WaterKegVisionAI } from './ai-vision.js';
import { SyncManager, SessionManager, createDefaultRoomState, DEMO_ROOM_STATE } from './storage.js';

class WaterKegApp {
  constructor() {
    this.visionAI = new WaterKegVisionAI();
    this.syncManager = new SyncManager((newState) => this.handleRemoteUpdate(newState));
    this.state = null;

    // Camera and scan state
    this.currentScanResult = null;
    this.webcamStream = null;

    this.initTheme();
    this.cacheDom();
    this.bindEvents();
    this.initSessionOrGatekeeper();
  }

  cacheDom() {
    // Root Views
    this.domLoginView = document.getElementById('loginView');
    this.domDashboardView = document.getElementById('dashboardView');

    // Auth & Gatekeeper
    this.domTabJoinRoomBtn = document.getElementById('tabJoinRoomBtn');
    this.domTabCreateRoomBtn = document.getElementById('tabCreateRoomBtn');
    this.domJoinRoomForm = document.getElementById('joinRoomForm');
    this.domCreateRoomForm = document.getElementById('createRoomForm');
    this.domLoginRoomCode = document.getElementById('loginRoomCode');
    this.domLoginUserName = document.getElementById('loginUserName');
    this.domNewHostelBlock = document.getElementById('newHostelBlock');
    this.domNewRoomNumber = document.getElementById('newRoomNumber');
    this.domNewCreatorName = document.getElementById('newCreatorName');

    // Dashboard Header
    this.domCurrentRoomCodeLabel = document.getElementById('currentRoomCodeLabel');
    this.domSwitchRoomBtn = document.getElementById('switchRoomBtn');
    this.domThemeToggleBtn = document.getElementById('themeToggleBtn');
    this.domThemeIconSun = document.getElementById('themeIconSun');
    this.domThemeIconMoon = document.getElementById('themeIconMoon');
    this.domLoginThemeToggleBtn = document.getElementById('loginThemeToggleBtn');
    this.domLoginThemeIconSun = document.getElementById('loginThemeIconSun');
    this.domLoginThemeIconMoon = document.getElementById('loginThemeIconMoon');

    // Identity Bar
    this.domActiveUserDisplay = document.getElementById('activeUserDisplay');
    this.domActiveUserAvatar = document.getElementById('activeUserAvatar');
    this.domActiveUserName = document.getElementById('activeUserName');
    this.domSwitchProfileBtn = document.getElementById('switchProfileBtn');

    // Keg Card
    this.domKegCard = document.getElementById('kegCard');
    this.domKegStatusBadge = document.getElementById('kegStatusBadge');
    this.domKegStatusText = document.getElementById('kegStatusText');
    this.domKegLiquid = document.getElementById('kegLiquid');
    this.domKegHeadline = document.getElementById('kegHeadline');
    this.domKegSubtitle = document.getElementById('kegSubtitle');
    this.domKegMetaDetails = document.getElementById('kegMetaDetails');
    this.domKegBubbleNotice = document.getElementById('kegBubbleNotice');
    this.domOpenRefillModalBtn = document.getElementById('openRefillModalBtn');
    this.domReportEmptyBtn = document.getElementById('reportEmptyBtn');

    // Spotlight Card
    this.domSpotlightCard = document.getElementById('spotlightCard');
    this.domSpotlightAvatar = document.getElementById('spotlightAvatar');
    this.domSpotlightName = document.getElementById('spotlightName');
    this.domSpotlightUrgencyBadge = document.getElementById('spotlightUrgencyBadge');
    this.domSpotlightLastRefill = document.getElementById('spotlightLastRefill');
    this.domSpotlightDeficit = document.getElementById('spotlightDeficit');

    // Queue & History
    this.domRoommatesCountBadge = document.getElementById('roommatesCountBadge');
    this.domOpenInviteBtn = document.getElementById('openInviteBtn');
    this.domQueueListContainer = document.getElementById('queueListContainer');
    this.domHistoryCountBadge = document.getElementById('historyCountBadge');
    this.domHistoryFeedContainer = document.getElementById('historyFeedContainer');

    // Refill Modal
    this.domRefillModal = document.getElementById('refillModal');
    this.domCloseRefillModalBtn = document.getElementById('closeRefillModalBtn');
    this.domRefillActiveUserName = document.getElementById('refillActiveUserName');
    this.domPhotoFileInput = document.getElementById('photoFileInput');
    this.domToggleWebcamBtn = document.getElementById('toggleWebcamBtn');
    this.domScannerBox = document.getElementById('scannerBox');
    this.domScannerVideo = document.getElementById('scannerVideo');
    this.domScannerPreviewImg = document.getElementById('scannerPreviewImg');
    this.domScannerPlaceholder = document.getElementById('scannerPlaceholder');
    this.domScannerHud = document.getElementById('scannerHud');
    this.domHudConfidence = document.getElementById('hudConfidence');
    this.domAiVerdictBox = document.getElementById('aiVerdictBox');
    this.domVerdictStatus = document.getElementById('verdictStatus');
    this.domVerdictIcon = document.getElementById('verdictIcon');
    this.domVerdictText = document.getElementById('verdictText');
    this.domVerdictConfidence = document.getElementById('verdictConfidence');
    this.domVerdictMeterFill = document.getElementById('verdictMeterFill');
    this.domVerdictDescription = document.getElementById('verdictDescription');
    this.domCaptureWebcamBtn = document.getElementById('captureWebcamBtn');
    this.domConfirmRefillSubmitBtn = document.getElementById('confirmRefillSubmitBtn');

    // Invite Modal
    this.domInviteModal = document.getElementById('inviteModal');
    this.domCloseInviteModalBtn = document.getElementById('closeInviteModalBtn');
    this.domInviteRoomCodeDisplay = document.getElementById('inviteRoomCodeDisplay');
    this.domInviteHostelRoomLabel = document.getElementById('inviteHostelRoomLabel');
    this.domInviteLinkInput = document.getElementById('inviteLinkInput');
    this.domCopyInviteMessageBtn = document.getElementById('copyInviteMessageBtn');

    // Profile Modal
    this.domProfileModal = document.getElementById('profileModal');
    this.domCloseProfileModalBtn = document.getElementById('closeProfileModalBtn');
    this.domProfileModalAvatar = document.getElementById('profileModalAvatar');
    this.domProfileModalName = document.getElementById('profileModalName');
    this.domProfileModalRoom = document.getElementById('profileModalRoom');
    this.domProfileModalFills = document.getElementById('profileModalFills');
    this.domProfileLogoutBtn = document.getElementById('profileLogoutBtn');

    // Lightbox Modal
    this.domLightboxModal = document.getElementById('lightboxModal');
    this.domCloseLightboxModalBtn = document.getElementById('closeLightboxModalBtn');
    this.domLightboxTitle = document.getElementById('lightboxTitle');
    this.domLightboxImage = document.getElementById('lightboxImage');
    this.domLightboxDetails = document.getElementById('lightboxDetails');

    // Toast
    this.domToastContainer = document.getElementById('toastContainer');
  }

  initTheme() {
    const savedTheme = localStorage.getItem('waterkeg_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('waterkeg_theme', next);
    this.updateThemeIcons(next);
  }

  updateThemeIcons(theme) {
    const isDark = theme === 'dark';
    if (this.domThemeIconSun) this.domThemeIconSun.style.display = isDark ? 'none' : 'block';
    if (this.domThemeIconMoon) this.domThemeIconMoon.style.display = isDark ? 'block' : 'none';
    if (this.domLoginThemeIconSun) this.domLoginThemeIconSun.style.display = isDark ? 'none' : 'block';
    if (this.domLoginThemeIconMoon) this.domLoginThemeIconMoon.style.display = isDark ? 'block' : 'none';
  }

  bindEvents() {
    // Theme
    if (this.domThemeToggleBtn) {
      this.domThemeToggleBtn.addEventListener('click', () => this.toggleTheme());
    }
    if (this.domLoginThemeToggleBtn) {
      this.domLoginThemeToggleBtn.addEventListener('click', () => this.toggleTheme());
    }
    this.updateThemeIcons(document.documentElement.getAttribute('data-theme'));

    // Auth Tabs
    this.domTabJoinRoomBtn.addEventListener('click', () => this.switchAuthTab('join'));
    this.domTabCreateRoomBtn.addEventListener('click', () => this.switchAuthTab('create'));
    this.domJoinRoomForm.addEventListener('submit', (e) => this.handleJoinRoomSubmit(e));
    this.domCreateRoomForm.addEventListener('submit', (e) => this.handleCreateRoomSubmit(e));

    // Dashboard navigation
    this.domSwitchRoomBtn.addEventListener('click', () => this.handleLeaveRoom());
    const currentRoomBadge = document.getElementById('currentRoomBadge');
    if (currentRoomBadge) {
      currentRoomBadge.addEventListener('click', () => this.handleLeaveRoom());
      currentRoomBadge.title = 'Click to switch room';
    }

    // Keg Actions
    this.domReportEmptyBtn.addEventListener('click', () => this.handleReportEmpty());
    this.domOpenRefillModalBtn.addEventListener('click', () => this.openRefillModal());
    this.domCloseRefillModalBtn.addEventListener('click', () => this.closeRefillModal());

    // Invite Modal
    this.domOpenInviteBtn.addEventListener('click', () => this.openInviteModal());
    this.domCloseInviteModalBtn.addEventListener('click', () => this.closeInviteModal());
    this.domCopyInviteMessageBtn.addEventListener('click', () => this.copyInviteMessage());

    // Identity & Logout
    this.domSwitchProfileBtn.addEventListener('click', () => this.openProfileModal());
    this.domCloseProfileModalBtn.addEventListener('click', () => this.closeProfileModal());
    if (this.domProfileLogoutBtn) {
      this.domProfileLogoutBtn.addEventListener('click', () => {
        this.closeProfileModal();
        this.handleLeaveRoom();
      });
    }

    // Lightbox
    this.domCloseLightboxModalBtn.addEventListener('click', () => this.closeLightboxModal());
    this.domScannerPreviewImg.addEventListener('click', () => {
      if (this.domScannerPreviewImg.src) {
        this.openLightbox(this.domScannerPreviewImg.src, 'Photo Preview', 'Uploaded Refill Proof');
      }
    });

    // Verification Inputs
    this.domPhotoFileInput.addEventListener('change', (e) => this.handlePhotoSelected(e));
    this.domToggleWebcamBtn.addEventListener('click', () => this.toggleWebcam());
    this.domCaptureWebcamBtn.addEventListener('click', () => this.captureWebcamFrame());
    this.domConfirmRefillSubmitBtn.addEventListener('click', () => this.submitRefill());

    const testFullBtn = document.getElementById('testFullKegBtn');
    if (testFullBtn) {
      testFullBtn.addEventListener('click', () => this.handleDirectTestPhoto('/RoomKegFill.jpeg'));
    }
    const testEmptyBtn = document.getElementById('testEmptyKegBtn');
    if (testEmptyBtn) {
      testEmptyBtn.addEventListener('click', () => this.handleDirectTestPhoto('/RoomKegEmpty.jpeg'));
    }

    // Expose direct test helpers on window for automated testing
    window.dryafTest = {
      testFull: () => this.handleDirectTestPhoto('/RoomKegFill.jpeg'),
      testEmpty: () => this.handleDirectTestPhoto('/RoomKegEmpty.jpeg'),
      app: this
    };

    // Modal backdrop click to close
    [this.domRefillModal, this.domInviteModal, this.domProfileModal, this.domLightboxModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeAllModals();
        }
      });
    });
  }

  closeAllModals() {
    this.closeRefillModal();
    this.closeInviteModal();
    this.closeProfileModal();
    this.closeLightboxModal();
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = type === 'urgent' ? '⚠️' : type === 'success' ? '✅' : '💧';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    this.domToastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // --- SESSION & GATEKEEPER ---
  initSessionOrGatekeeper() {
    // Check URL parameters e.g. ?room=B-304
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');

    const session = SessionManager.getSession();

    if (session && session.roomCode) {
      // Load room state
      const room = this.syncManager.loadRoomState(session.roomCode);
      if (room) {
        this.state = room;
        this.state.currentUserId = session.userId;
        this.state.currentUserName = session.userName;
        this.showDashboard();
        return;
      }
    }

    // If room param in URL, prefill Join Room code
    if (roomParam) {
      this.domLoginRoomCode.value = roomParam.toUpperCase();
    }

    this.showLogin();
  }

  showLogin() {
    this.domLoginView.style.display = 'flex';
    this.domDashboardView.style.display = 'none';
  }

  showDashboard() {
    this.domLoginView.style.display = 'none';
    this.domDashboardView.style.display = 'block';
    this.render();
  }

  switchAuthTab(tab) {
    if (tab === 'join') {
      this.domTabJoinRoomBtn.classList.add('active');
      this.domTabCreateRoomBtn.classList.remove('active');
      this.domJoinRoomForm.style.display = 'block';
      this.domCreateRoomForm.style.display = 'none';
    } else {
      this.domTabCreateRoomBtn.classList.add('active');
      this.domTabJoinRoomBtn.classList.remove('active');
      this.domCreateRoomForm.style.display = 'block';
      this.domJoinRoomForm.style.display = 'none';
    }
  }

  handleJoinRoomSubmit(e) {
    e.preventDefault();
    const code = this.domLoginRoomCode.value.trim().toUpperCase();
    const name = this.domLoginUserName.value.trim();
    if (!code || !name) return;

    let room = this.syncManager.loadRoomState(code);
    if (!room) {
      // Auto-create room for that code if not existing
      room = createDefaultRoomState(code, code, name);
    }

    // Check if roommate exists or add new
    let user = room.roommates.find(r => r.name.toLowerCase() === name.toLowerCase());
    if (!user) {
      const avatars = ['👤', '⚡', '☕', '🎧', '🌱', '🏄', '🦊'];
      user = {
        id: `usr-${Date.now()}`,
        name,
        avatar: avatars[Math.floor(Math.random() * avatars.length)],
        lastFilledAt: null,
        totalFills: 0,
        status: 'active'
      };
      room.roommates.push(user);
    }

    room.currentUserId = user.id;
    room.currentUserName = user.name;
    this.state = room;

    SessionManager.setSession(room.roomCode, user.id, user.name);
    this.persistState();
    this.showDashboard();
    this.showToast(`Welcome to ${room.hostelBlock} • Room ${room.roomNumber}, ${user.name}!`, 'success');
  }

  handleCreateRoomSubmit(e) {
    e.preventDefault();
    const block = this.domNewHostelBlock.value.trim();
    const roomNum = this.domNewRoomNumber.value.trim();
    const creator = this.domNewCreatorName.value.trim();
    if (!block || !roomNum || !creator) return;

    const room = createDefaultRoomState(block, roomNum, creator);
    this.state = room;

    SessionManager.setSession(room.roomCode, room.currentUserId, room.currentUserName);
    this.persistState();
    this.showDashboard();
    this.showToast(`Room created for ${room.hostelBlock} • Room ${room.roomNumber}!`, 'success');
  }

  handleLeaveRoom() {
    SessionManager.clearSession();
    this.state = null;

    // Remove any query params so user starts fresh with clean join/create view
    try {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.pushState({}, document.title, cleanUrl);
    } catch {
      // Ignore
    }

    if (this.domLoginRoomCode) this.domLoginRoomCode.value = '';
    if (this.domLoginUserName) this.domLoginUserName.value = '';

    this.showLogin();
    this.showToast('Switched room. Join or create a new room below.', 'info');
  }

  getCurrentUser() {
    if (!this.state || !this.state.roommates) return { id: 'usr-anon', name: 'You', avatar: '👤' };
    const user = this.state.roommates.find(r => r.id === this.state.currentUserId);
    return user || this.state.roommates[0] || { id: 'usr-anon', name: 'You', avatar: '👤' };
  }

  handleRemoteUpdate(remoteState) {
    if (remoteState && this.state && remoteState.roomCode === this.state.roomCode) {
      this.state = { ...this.state, ...remoteState };
      this.render();
      this.showToast('Room updated with roommate activity', 'info');
    }
  }

  persistState() {
    if (this.state) {
      this.syncManager.syncState(this.state);
      this.render();
    }
  }

  // --- KEG STATE ACTIONS ---
  handleReportEmpty() {
    const active = this.getCurrentUser();
    this.state.kegStatus = 'empty';
    this.state.lastEmptiedAt = new Date().toISOString();
    this.state.lastEmptiedBy = active.name;

    const totalFills = this.state.refillLogs ? this.state.refillLogs.length : 0;
    const queue = calculateLRUQueue(this.state.roommates, totalFills, 'fairness-weighted');
    const nextRoommate = queue[0];

    this.persistState();

    if (nextRoommate) {
      this.showToast(`🚨 DEHYDRATION ALARM! Dry as dust — It's ${nextRoommate.name}'s turn to sacrifice!`, 'urgent');
    } else {
      this.showToast('🚨 DEHYDRATION ALARM! Water reservoir depleted!', 'urgent');
    }
  }

  // --- REFILL MODAL (Locked to Current User) ---
  openRefillModal() {
    this.stopWebcam();
    this.currentScanResult = null;
    this.domConfirmRefillSubmitBtn.disabled = true;
    this.domConfirmRefillSubmitBtn.textContent = 'Confirm & Log Refill';
    this.domAiVerdictBox.style.display = 'none';
    this.domScannerPlaceholder.style.display = 'block';
    this.domScannerVideo.style.display = 'none';
    this.domScannerPreviewImg.style.display = 'none';
    this.domScannerHud.style.display = 'none';
    this.domCaptureWebcamBtn.style.display = 'none';

    // Lock to active user
    const current = this.getCurrentUser();
    this.domRefillActiveUserName.textContent = current.name;

    this.domRefillModal.classList.add('active');
  }

  closeRefillModal() {
    this.stopWebcam();
    this.domRefillModal.classList.remove('active');
  }

  async handlePhotoSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    this.stopWebcam();
    this.domScannerPlaceholder.style.display = 'none';
    this.domScannerVideo.style.display = 'none';
    this.domScannerPreviewImg.style.display = 'block';
    this.domScannerHud.style.display = 'flex';
    this.domHudConfidence.textContent = 'Scanning...';

    const reader = new FileReader();
    reader.onload = async (e) => {
      this.domScannerPreviewImg.src = e.target.result;
      await this.runAiVerification(file);
    };
    reader.readAsDataURL(file);
  }

  async handleDirectTestPhoto(imagePath) {
    this.stopWebcam();
    this.domScannerPlaceholder.style.display = 'none';
    this.domScannerVideo.style.display = 'none';
    this.domScannerPreviewImg.style.display = 'block';
    this.domScannerPreviewImg.src = imagePath;
    this.domScannerHud.style.display = 'flex';
    this.domHudConfidence.textContent = 'Scanning...';
    await this.runAiVerification(imagePath);
  }

  async toggleWebcam() {
    if (this.webcamStream) {
      this.stopWebcam();
      return;
    }

    try {
      this.webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      this.domScannerVideo.srcObject = this.webcamStream;
      this.domScannerVideo.style.display = 'block';
      this.domScannerPlaceholder.style.display = 'none';
      this.domScannerPreviewImg.style.display = 'none';
      this.domScannerHud.style.display = 'flex';
      this.domCaptureWebcamBtn.style.display = 'block';
      this.domToggleWebcamBtn.textContent = '❌ Stop Camera';
    } catch {
      this.showToast('Camera not available. Please upload a photo instead.', 'urgent');
    }
  }

  stopWebcam() {
    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach(t => t.stop());
      this.webcamStream = null;
    }
    this.domToggleWebcamBtn.textContent = '📷 Use Camera';
    this.domCaptureWebcamBtn.style.display = 'none';
  }

  async captureWebcamFrame() {
    if (!this.webcamStream) return;
    this.domHudConfidence.textContent = 'Scanning...';
    await this.runAiVerification(this.domScannerVideo);
    this.stopWebcam();
    this.domScannerVideo.style.display = 'none';
    this.domScannerPreviewImg.style.display = 'block';
    if (this.currentScanResult) {
      this.domScannerPreviewImg.src = this.currentScanResult.annotatedImage;
    }
  }

  async runAiVerification(imageSource) {
    try {
      this.domScannerBox.classList.add('scanning');
      this.domHudConfidence.textContent = 'Analyzing water level...';

      const result = await this.visionAI.analyzeWaterKeg(imageSource);
      this.currentScanResult = result;

      this.domHudConfidence.textContent = `${result.confidence}% Match`;
      this.domScannerPreviewImg.src = result.annotatedImage;

      this.domAiVerdictBox.style.display = 'block';
      if (result.verified) {
        this.domVerdictStatus.className = 'verdict-status pass';
        this.domVerdictIcon.textContent = '✓';
        this.domVerdictText.textContent = `Water Level: ${result.waterLevel}% (Verified Full)`;
        this.domVerdictMeterFill.className = 'verdict-meter-fill';
        this.domVerdictMeterFill.style.width = `${result.waterLevel}%`;
        this.domVerdictDescription.textContent =
          `Water level verified! Keg is ready to be logged under your name.`;
        this.domConfirmRefillSubmitBtn.disabled = false;
        this.domConfirmRefillSubmitBtn.textContent = 'Confirm & Log Refill (Verified)';
      } else {
        this.domVerdictStatus.className = 'verdict-status fail';
        this.domVerdictIcon.textContent = '❌';
        this.domVerdictText.textContent = `Water Level: ${result.waterLevel}% (Keg Not Full / Empty)`;
        this.domVerdictMeterFill.className = 'verdict-meter-fill low';
        this.domVerdictMeterFill.style.width = `${result.waterLevel}%`;
        this.domVerdictDescription.textContent =
          `Water level is below the 75% threshold. Please fill the water keg completely before uploading. [Debug: Tint=${result.containerTint}, Grad=${Math.round(result.neckMaxGrad || 0)}, Contrast=${Math.round(result.avgMidContrast || 0)}]`;
        this.domConfirmRefillSubmitBtn.disabled = true;
        this.domConfirmRefillSubmitBtn.textContent = 'Keg Not Full — Cannot Log Refill';
      }
    } catch (err) {
      console.error('Vision analysis error:', err);
      this.showToast('Could not process photo. Please try again.', 'urgent');
    } finally {
      this.domScannerBox.classList.remove('scanning');
    }
  }

  submitRefill() {
    if (this.currentScanResult && !this.currentScanResult.verified) {
      this.showToast('Verification Failed: Keg is empty or not full!', 'urgent');
      return;
    }

    const current = this.getCurrentUser();
    const roommate = this.state.roommates.find(r => r.id === current.id);
    if (!roommate) return;

    const now = new Date().toISOString();
    const scan = this.currentScanResult || {
      verified: true,
      waterLevel: 94,
      confidence: 95,
      annotatedImage: null,
      compressedImage: null
    };

    // Update Roommate refill stats
    roommate.lastFilledAt = now;
    roommate.totalFills = (roommate.totalFills || 0) + 1;

    // Update Keg state
    this.state.kegStatus = 'full';
    this.state.lastFilledAt = now;
    this.state.lastFilledBy = roommate.name;
    this.state.lastEmptiedAt = null;
    this.state.lastEmptiedBy = null;

    // Log entry
    const newLog = {
      id: `log-${Date.now()}`,
      roommateId: roommate.id,
      roommateName: roommate.name,
      avatar: roommate.avatar,
      timestamp: now,
      waterLevelDetected: scan.waterLevel,
      confidence: scan.confidence,
      verified: scan.verified,
      reported: false,
      photoUrl: scan.compressedImage || scan.annotatedImage || null
    };

    if (!this.state.refillLogs) this.state.refillLogs = [];
    this.state.refillLogs.unshift(newLog);
    if (this.state.refillLogs.length > 30) this.state.refillLogs.pop();

    this.persistState();
    this.closeRefillModal();

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#0284c7', '#38bdf8', '#f59e0b', '#10b981', '#ef4444']
    });

    this.showToast(`🎉 OASIS RESTORED! ${roommate.name} saved the dorm from shriveling!`, 'success');
  }

  // --- REPORT OLD / FRAUDULENT IMAGE ---
  handleReportRefill(logId) {
    const log = this.state.refillLogs.find(l => l.id === logId);
    if (!log || log.reported) return;

    if (confirm(`CALL BLUFF? Report this image as fake or old water? This will deduct 1 fill count from ${log.roommateName}.`)) {
      // Find the roommate and decrement their count
      const author = this.state.roommates.find(r => r.id === log.roommateId);
      if (author) {
        author.totalFills = Math.max(0, (author.totalFills || 1) - 1);
      }

      log.reported = true;
      log.reportedBy = this.getCurrentUser().name;
      log.reportedAt = new Date().toISOString();

      this.persistState();
      this.showToast(`🚩 BLUFF CALLED! 1 fill revoked from ${log.roommateName}.`, 'urgent');
    }
  }

  // --- INVITE MODAL ---
  openInviteModal() {
    this.domInviteRoomCodeDisplay.textContent = this.state.roomCode;
    this.domInviteHostelRoomLabel.textContent = `${this.state.hostelBlock} • Room ${this.state.roomNumber}`;

    const url = new URL(window.location.origin);
    url.searchParams.set('room', this.state.roomCode);
    this.domInviteLinkInput.value = url.toString();

    this.domInviteModal.classList.add('active');
  }

  closeInviteModal() {
    this.domInviteModal.classList.remove('active');
  }

  copyInviteMessage() {
    const code = this.state.roomCode;
    const block = this.state.hostelBlock;
    const room = this.state.roomNumber;
    const link = `${window.location.origin}/?room=${code}`;

    const message = `🚨 DRYAF OASIS SUMMONS!\nJoin our hostel dehydration survival tracker for ${block} Room ${room}:\n${link}\nOasis Code: ${code}`;

    navigator.clipboard.writeText(message).then(() => {
      this.showToast('📢 Wasteland summons copied! Send to roommates.', 'success');
      this.closeInviteModal();
    }).catch(() => {
      prompt('Copy invite message:', message);
    });
  }

  // --- ROOMMATE ACCOUNT MODAL ---
  openProfileModal() {
    const user = this.getCurrentUser();
    if (this.domProfileModalAvatar) this.domProfileModalAvatar.textContent = user.avatar;
    if (this.domProfileModalName) this.domProfileModalName.textContent = user.name;
    if (this.domProfileModalRoom && this.state) {
      this.domProfileModalRoom.textContent = `${this.state.hostelBlock} • Room ${this.state.roomNumber}`;
    }
    if (this.domProfileModalFills) {
      this.domProfileModalFills.textContent = `${user.totalFills || 0} refills logged`;
    }
    this.domProfileModal.classList.add('active');
  }

  closeProfileModal() {
    this.domProfileModal.classList.remove('active');
  }

  // --- LIGHTBOX ---
  openLightbox(photoUrl, title, details) {
    this.domLightboxImage.src = photoUrl;
    this.domLightboxTitle.textContent = title;
    this.domLightboxDetails.textContent = details;
    this.domLightboxModal.classList.add('active');
  }

  closeLightboxModal() {
    this.domLightboxModal.classList.remove('active');
  }

  // --- MAIN RENDER LOOP ---
  render() {
    if (!this.state) return;

    const { hostelBlock, roomNumber, kegStatus, lastFilledAt, lastFilledBy, lastEmptiedAt, lastEmptiedBy } = this.state;
    const totalHouseholdFills = this.state.refillLogs 
      ? this.state.refillLogs.filter(l => !l.reported).length 
      : 0;

    // Use fairness-weighted sorting: lowest total fills first, rotated by time
    const queue = calculateLRUQueue(this.state.roommates, totalHouseholdFills, 'fairness-weighted');
    const currentUser = this.getCurrentUser();
    const nextRoommate = queue[0];

    // 1. Header
    this.domCurrentRoomCodeLabel.textContent = `${hostelBlock} • Room ${roomNumber}`;

    // 2. Active User Display
    if (this.domActiveUserAvatar) this.domActiveUserAvatar.textContent = currentUser.avatar;
    if (this.domActiveUserName) this.domActiveUserName.textContent = currentUser.name;
    if (this.domSwitchProfileBtn) {
      this.domSwitchProfileBtn.title = `Logged in as ${currentUser.name} • Click to switch roommate`;
    }

    // 3. Keg Card
    const isEmpty = kegStatus === 'empty';
    if (isEmpty) {
      this.domKegStatusBadge.className = 'keg-status-badge empty';
      this.domKegStatusText.textContent = 'DRY AS DUST (0%)';
      this.domKegLiquid.className = 'keg-liquid empty';
      this.domKegHeadline.textContent = 'OASIS IS BONE DRY! 💀';
      this.domKegSubtitle.textContent = lastEmptiedBy 
        ? `Alarm sounded by ${lastEmptiedBy} (${formatTimeAgo(lastEmptiedAt)})`
        : 'Dehydration imminent — Refill needed!';
      if (this.domKegMetaDetails) this.domKegMetaDetails.textContent = '0 Gallons Remaining • Dorm Survival Threatened';
      if (this.domKegBubbleNotice) this.domKegBubbleNotice.textContent = nextRoommate 
        ? `🚨 DRY AS DUST! ${nextRoommate.name} MUST SACRIFICE!` 
        : '🚨 WATER RESERVOIR DEPLETED!';
      this.domReportEmptyBtn.style.display = 'none';
      this.domOpenRefillModalBtn.textContent = '📸 SNAP PROOF OF OASIS';
    } else {
      this.domKegStatusBadge.className = 'keg-status-badge full';
      this.domKegStatusText.textContent = 'OASIS SECURED (100%)';
      this.domKegLiquid.className = 'keg-liquid';
      this.domKegHeadline.textContent = 'OASIS IS FULL & CHILLED 💧';
      this.domKegSubtitle.textContent = lastFilledBy 
        ? `Saved by ${lastFilledBy} (${formatTimeAgo(lastFilledAt)})`
        : 'Ready for drinking';
      if (this.domKegMetaDetails) this.domKegMetaDetails.textContent = '5-Gallon Drinking Water Reservoir';
      if (this.domKegBubbleNotice) this.domKegBubbleNotice.textContent = `"STAY HYDRATED, WASTELANDERS!" 💧`;
      this.domReportEmptyBtn.style.display = 'inline-flex';
      this.domOpenRefillModalBtn.textContent = '📸 SNAP PROOF OF OASIS';
    }

    // 4. Spotlight Card (Next Up to Refill)
    if (nextRoommate) {
      this.domSpotlightAvatar.textContent = nextRoommate.avatar;
      this.domSpotlightName.textContent = nextRoommate.name;
      this.domSpotlightLastRefill.textContent = formatTimeAgo(nextRoommate.lastFilledAt);

      const deficitText = nextRoommate.deficit > 0 
        ? `-${nextRoommate.deficit} fills behind` 
        : `+${Math.abs(nextRoommate.deficit)} ahead`;
      this.domSpotlightDeficit.textContent = deficitText;

      this.domSpotlightUrgencyBadge.className = `spotlight-urgency ${nextRoommate.urgencyLevel}`;
      this.domSpotlightUrgencyBadge.innerHTML = `<span>${nextRoommate.urgencyLabel}</span>`;
    } else {
      this.domSpotlightName.textContent = 'No Roommates';
      this.domSpotlightLastRefill.textContent = '—';
      this.domSpotlightDeficit.textContent = '—';
    }

    // 5. Roommate Turn Queue
    this.domRoommatesCountBadge.textContent = `${this.state.roommates.length} Roommates`;
    this.domQueueListContainer.innerHTML = '';

    const maxFills = Math.max(...this.state.roommates.map(r => r.totalFills || 0), 1);

    queue.forEach((roommate, index) => {
      const card = document.createElement('div');
      const rankNum = index + 1;
      const isAway = roommate.status === 'away';
      card.className = `queue-card ${rankNum === 1 && !isAway ? 'rank-1' : ''}`;

      const isTopFiller = (roommate.totalFills || 0) === maxFills && roommate.totalFills > 0;
      const isCactus = (roommate.totalFills || 0) === 0;
      const comicBadgeTitle = rankNum === 1 ? '🔥 NEXT SACRIFICE' : isTopFiller ? '👑 OASIS SAVIOR' : isCactus ? '🌵 HUMAN CACTUS' : '💧 WATER WARRIOR';

      card.innerHTML = `
        <div class="queue-left">
          <div class="queue-rank">#${rankNum}</div>
          <div class="queue-avatar">${roommate.avatar}</div>
          <div class="queue-user-info">
            <span class="queue-user-name">
              ${roommate.name}
              <span class="spotlight-urgency ${roommate.urgencyLevel}" style="font-size: 0.7rem; padding: 2px 6px;">
                ${comicBadgeTitle}
              </span>
            </span>
            <span class="queue-user-sub">
              Last filled: ${formatTimeAgo(roommate.lastFilledAt)} • ${roommate.totalFills || 0} total fills (${roommate.fillPercentage}% share)
            </span>
          </div>
        </div>

        <div class="queue-right">
          <div class="fairness-bar-container" title="${roommate.fillPercentage}% of household refills">
            <div class="fairness-bar-fill" style="width: ${Math.max(8, roommate.fillPercentage)}%;"></div>
          </div>
        </div>
      `;

      this.domQueueListContainer.appendChild(card);
    });

    // 6. Refill History Feed
    const logs = this.state.refillLogs || [];
    this.domHistoryCountBadge.textContent = `${logs.length} Fills`;
    this.domHistoryFeedContainer.innerHTML = '';

    if (logs.length === 0) {
      this.domHistoryFeedContainer.innerHTML = `
        <div class="empty-state" style="text-align: center; padding: 30px; font-family: var(--font-comic); font-weight: 700; color: var(--text-secondary);">
          <p>🌵 No refills recorded in the chronicles yet. Be the first to save the dorm!</p>
        </div>
      `;
    } else {
      logs.forEach(log => {
        const item = document.createElement('div');
        item.className = `history-card ${log.reported ? 'reported' : ''}`;

        const photoHtml = log.photoUrl 
          ? `<img src="${log.photoUrl}" class="history-photo-thumb" alt="Proof" title="Click to enlarge" />`
          : `<div class="history-photo-thumb" style="display:flex;align-items:center;justify-content:center;background:var(--bg-subtle);font-size:1.2rem;">💧</div>`;

        const badgeHtml = log.reported
          ? `<span class="spotlight-urgency urgent" style="font-size:0.75rem;">⚠️ BLUFF CALLED / VOIDED</span>`
          : `<div class="history-badge">✓ VERIFIED OASIS</div>`;

        const reportBtnHtml = !log.reported
          ? `<button class="btn-report" title="Call bluff on older or duplicate photo">🚩 CALL BLUFF</button>`
          : `<span style="font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);">Voided</span>`;

        item.innerHTML = `
          <div class="history-left">
            ${photoHtml}
            <div class="history-details">
              <span class="history-filler">${log.roommateName} refilled the oasis</span>
              <span class="history-time">${formatTimeAgo(log.timestamp)}</span>
            </div>
          </div>
          <div class="history-actions">
            ${badgeHtml}
            ${reportBtnHtml}
          </div>
        `;

        if (log.photoUrl) {
          const thumb = item.querySelector('.history-photo-thumb');
          thumb.addEventListener('click', () => {
            this.openLightbox(
              log.photoUrl,
              `Refill Proof by ${log.roommateName}`,
              `Logged: ${new Date(log.timestamp).toLocaleString()} • ${log.reported ? 'Flagged as Duplicate' : 'Verified Full'}`
            );
          });
        }

        if (!log.reported) {
          const rBtn = item.querySelector('.btn-report');
          rBtn.addEventListener('click', () => this.handleReportRefill(log.id));
        }

        this.domHistoryFeedContainer.appendChild(item);
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new WaterKegApp();
});
