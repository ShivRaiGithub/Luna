# 🌑 Luna — Web2.5 wallet for Midnight Network

Luna is a non-custodial browser wallet for the [Midnight Network](https://midnight.network) that brings Web2-level simplicity to Web3 wallets.

## ✨ Capabilities

- Login with email
- Downloadable backup file (easy to store in multiple places)
- Backup file leak safety (backup file alone cannot drain funds)
- Forget/reset password flow
- Restore wallet on any device with email + backup file + password
- NIGHT balance viewing
- Dust generation
- Network switching across 4 networks
- View/copy addresses: shielded, unshielded, and dust
- Address QR display
- Send NIGHT tokens

---

## 📁 Project Structure

```
luna/
├── frontend/       # React + TypeScript site + wallet web app
├── backend/        # Express + TypeScript API (auth, backup, dApp relay)
└── extension/      # Browser extension (Manifest V3, React popup)
```

---

## 🚀 Setup And Run

### Prerequisites
- Node.js 18+
- npm

### 1. Clone Repository

```bash
git clone <repo-url>
cd luna
```

### 2. Install Packages

Install dependencies for all apps:

```bash
cd frontend && npm install
cd ../backend && npm install
cd ../extension && npm install
cd ..
```

### 3. Configure Environment Variables

Only backend requires an env file.

```bash
cd backend
cp .env.example .env
```

Then edit `.env` and set at least:

- `JWT_SECRET`
- `SMTP_USER`
- `SMTP_PASS`
- `CORS_ORIGIN` (usually `http://localhost:3000`)
- `MONGODB_URI`

### 4. Run The Repo (Development)

Open separate terminals from repo root:

Terminal 1 (backend):

```bash
cd backend
npm run dev
```

Terminal 2 (frontend):

```bash
cd frontend
npm start
```

Optional Terminal 3 (extension watch build):

```bash
cd extension
npm run dev
```

App URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

---

**Load Extension in Chrome:**
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/dist/` folder

---


## 🌐 dApp Integration

dApps can connect to Luna using the injected `window.luna` provider:

```javascript
// Check if Luna is installed
if (window.luna?.isLuna) {
  // Connect wallet
  const { address } = await window.luna.connect();
  console.log('Connected:', address);

  // Send a transaction
  const { txHash } = await window.luna.signAndSubmit({
    to: 'mn1abc...',
    amount: '5.0',
    memo: 'Payment',
  });

  // Listen for events
  window.luna.on('connect', ({ address }) => console.log('Connected:', address));
  window.luna.on('disconnect', () => console.log('Disconnected'));
}
```

---

## 📄 License

MIT — Built for the Midnight ecosystem.
