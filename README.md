# 🌵 DryAF — Hostel Dehydration Survival Guide

> *"Who left the oasis dry again?!"* 💀  
> **DryAF** is a comedic, neo-brutalist web application designed for college dorms and student hostels to track whose turn it is to refill the drinking water keg. Packed with on-device computer vision verification, fairness-weighted turn rotation, interactive Wheel of Sacrifice tie-breaking, and cartoon wasteland survival lore.

---

## 🌐 Live Application

🚀 **Play / Use DryAF Live:** [https://dryaf-oasis-65def.web.app/](https://dryaf-oasis-65def.web.app/)

---

## 🏜️ The Backstory

Every hostel dorm suffers from the same tragedy of the commons:
1. The 5-gallon water keg runs bone dry.
2. Everyone pretends not to notice and survives on sips from tap water or energy drinks.
3. The same generous roommate ends up hauling the heavy refill bottle every single time while slackers evade their turn.

**DryAF solves this with uncompromising hostel diplomacy, mathematical parity, and on-device AI.**

---

## ✨ Features

### 🔐 Mandatory Google OAuth Verification
- **Verified Hostel Identity**: Seamless Google Sign-In with official Google identity pills, user profile avatars, and authentic Google display names.
- **Strict Single-Gatekeeper**: No mock credentials or insecure name bypasses; accounts and refill chronologies are anchored to authentic Google accounts.
- **Cross-Device Session Continuity**: Automatically remembers user rooms and profiles via secure local and cloud tokens.

### 🎡 The Wheel of Sacrifice (Equal-Priority Tie-Breaker)
- **Hostel Fate Engine**: When the keg goes dry and multiple roommates share equal top priority (identical refill count & equal parchedness), the **Wheel of Sacrifice** activates.
- **Survivor Consensus**: Requires all tied candidates to click **"I Agree to Spin"** before the wheel unlocks.
- **Real-Time Synchronized Spin**: Live circular canvas stage with authentic needle flapper physics, ticking audio feedback (via Web Audio API), synchronized multi-client countdown, and suspenseful deceleration to pick the sacrificial filler.
- **Anti-Spoiler Protection**: Prevents winner reveals in the dashboard turn order until the physical spin completes across all roommates' devices.

### 🎨 Cartoon Wasteland & Comic Survival Aesthetic
- **Neo-Brutalist Comic Panels**: Hand-inked vector outlines (`3px solid #18181B`), unblurred hard block shadows (`4px 4px 0px #18181B`), and comic speech bubbles with directional tails.
- **Scenic Oasis Backdrops**: Full-bleed illustrated desert oasis landscapes:
  - ☀️ **Day Mode**: Sun-baked golden dunes, glistening turquoise oasis pool, palm trees, and sunrise canyon horizon.
  - 🌙 **Wasteland Night Mode**: Starry indigo desert sky, glowing crescent moon, and bioluminescent oasis waters.
- **Sarcastic Dorm Lore**: Roommates are ranked into humorous survival categories:
  - 👑 **Oasis Savior**: Most refills logged for the room.
  - 🔥 **Next Sacrifice**: The roommate mathematically due to refill next.
  - 🌵 **Human Cactus**: Refill evader with the largest deficit.
  - 💀 **Oasis Debtor**: Roommates caught bluffing or in negative refill balance.

### 🤖 100% Client-Side AI Computer Vision Scanner
- **Fluid Lens Caustics & Meniscus Detection**: Uses vertical luminance gradient analysis and cylindrical refraction contrast to verify that a keg is genuinely full before allowing a refill submission.
- **Multi-Spectral Container Support**: Handles both standard clear plastic containers and amber/orange-tinted water kegs via red-blue chromatic differential analysis.
- **Anti-Empty Safeguard**: Strictly blocks empty or half-filled containers from being submitted.
- **Zero Server Dependencies**: Runs entirely in the user's browser using HTML5 Canvas pixel analysis. Zero images are sent to external servers or cloud APIs.

### ⚖️ Fairness-Weighted Parity Queue
- **Equalization Parity**: Prioritizes roommates who have completed fewer total fills until parity is reached across the dorm.
- **LRU Tie-Breaking**: When roommates share the same fill count, uses Least-Recently-Used (time since last fill) to rotate order.

### 🚪 Hostel Room Access & Locked Identity
- **Hostel Block & Room Identification**: Join an existing room via a room code (e.g., `B-304` or `K-430`) or found one using **Hostel Block** + **Room Number**.
- **Device-Locked Single Identity**: Uploads are permanently attributed to the active Google user on that device. Roommates cannot impersonate someone else.
- **Instant Logout**: A dedicated personal dossier modal with a one-click *"Flee Oasis"* logout action.

### ⚖️ 3-Person Consensus Tribunal ("Call Bluff")
- If a roommate uploads a fake, old, or empty bottle photo, room members can click **"🚩 Call Bluff"** in the Oasis Chronicles feed.
- Launches a dedicated **Tribunal Modal** tracking required roommate consensus votes.
- Upon quorum consensus, the fraudulent refill is voided, and the cheater is hit with an automatic **-2 fills deception penalty**.

### 📢 One-Click Roommate Summons
- Single-click copyable WhatsApp / SMS invite link pre-formatted with the room code and direct URL to rally thirsty roommates into the rotation.

---

## 🛠️ Tech Stack

- **Core**: Vanilla JavaScript (ES Modules), Semantic HTML5
- **Styling**: Vanilla CSS3 Design System (Custom properties, Neo-brutalism, Comic typography)
- **Authentication**: Firebase Authentication (Google OAuth provider)
- **Cloud Database & Hosting**: Firebase Firestore & Firebase Hosting
- **Audio & FX**: Web Audio API (procedural flapper clicks) & [canvas-confetti](https://www.npmjs.com/package/canvas-confetti)
- **Tooling & Bundler**: [Vite](https://vitejs.dev/)
- **Visuals & Typography**: Google Fonts (`Bungee`, `Space Grotesk`, `Inter`, `JetBrains Mono`)
- **Offline / Local Sync**: HTML5 `BroadcastChannel` & `localStorage` fallback

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or newer)
- npm or yarn

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/TEA-21/DryAF.git
cd DryAF

# 2. Install dependencies
npm install

# 3. Start the local development server
npm run dev
```

Open your browser and navigate to `http://localhost:5173/`.

### Production Build

```bash
# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

The optimized static assets will be output to the `dist/` directory, ready to be hosted on GitHub Pages, Vercel, Netlify, or any static web host.

---

## 📁 Project Structure

```
dryaf/
├── public/
│   ├── oasis_backdrop_day.jpg    # Illustrated Day Oasis backdrop
│   ├── oasis_backdrop_night.jpg  # Illustrated Night Oasis backdrop
│   ├── sample_filled_keg.jpg     # Clear transparent filled keg test asset
│   ├── sample_orange_keg.jpg     # Amber tinted filled keg test asset
│   └── sample_empty_keg.jpg      # Empty keg test asset
├── src/
│   ├── ai-vision.js              # Client-side fluid lens caustics & meniscus computer vision engine
│   ├── app.js                    # Main application controller, state binding & audio-visual effects
│   ├── lru.js                    # Fairness parity queue & LRU rotation algorithms
│   ├── storage.js                # Dual-mode storage engine (localStorage, BroadcastChannel, Firestore)
│   └── style.css                 # Cartoon Wasteland & Neo-brutalist design system
├── index.html                    # Semantic app shell, Oasis Gatekeeper & interactive visualizer
├── package.json                  # Project dependencies & scripts
├── .gitignore                    # Git ignore rules
└── README.md                     # Documentation
```

---

## 🧠 How the Computer Vision Fluid Engine Works

The computer vision engine ([src/ai-vision.js](src/ai-vision.js)) evaluates liquid fill levels inside cylindrical plastic containers without neural network weight downloads:

1. **Top Neck Meniscus Detection**: Computes vertical Sobel luminance gradients ($\Delta Y / \Delta y$) across the upper bottle neck ($y \in [14\%, 38\%]$). A full container exhibits a sharp water meniscus boundary transition ($\ge 18$).
2. **Cylindrical Fluid Lens Caustics**: A solid 5-gallon cylinder of water acts as an intense optical magnifying lens, creating distinct bright caustic focal bands ($\ge 172$) in the center liquid column compared to diffuse empty air ($\le 150$).
3. **Multi-Spectral Tint Discrimination**: Measures red-to-blue chroma differential $(R - B)$ and blue absorption across the liquid column, reliably classifying both clear and amber/orange plastic containers.

---

## 📄 License

MIT License. Built for thirsty hostel students everywhere. Stay hydrated! 💧🌵
