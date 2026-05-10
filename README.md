# Chess Trainer — Setup Guide

Follow every step in order. Don't skip anything.

---

## What you need to install (one time only)

### 1. Python 3.10+
Check if you have it:
```
python --version
```
If it says 3.10 or higher, skip this step.
If not, download from: https://www.python.org/downloads/
During install on Windows: check "Add Python to PATH" ✓

---

### 2. Node.js 18+
Check if you have it:
```
node --version
```
If it says v18 or higher, skip this step.
If not, download from: https://nodejs.org (choose the LTS version)

---

### 3. Stockfish (the chess engine)

**Windows:**
1. Go to: https://stockfishchess.org/download/
2. Download the Windows version
3. Unzip it — you'll get a file like `stockfish-windows-x86-64.exe`
4. Put it somewhere easy, like: `C:\stockfish\stockfish.exe`
5. Remember this path — you'll need it in step 6 below

**Mac:**
```
brew install stockfish
```
If you don't have Homebrew: https://brew.sh

**Linux (Ubuntu/Debian):**
```
sudo apt install stockfish
```

---

### 4. Get an Anthropic API key
1. Go to: https://console.anthropic.com
2. Sign up / log in
3. Click "API Keys" → "Create Key"
4. Copy it — you'll need it in step 6

---

## Setting up the project

### 5. Set up the Python backend

Open a terminal / command prompt and run:

```bash
cd chess-trainer/backend

# Create a virtual environment (keeps packages isolated)
python -m venv venv

# Activate it:
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# You should see (venv) at the start of your prompt now

# Install all Python packages
pip install -r requirements.txt
```

---

### 6. Create your .env file

Still inside the `backend` folder:

```bash
# Copy the example file
# Windows:
copy .env.example .env
# Mac/Linux:
cp .env.example .env
```

Now open `.env` in any text editor and fill it in:

```
ANTHROPIC_API_KEY=sk-ant-...your key here...

# Windows example:
STOCKFISH_PATH=C:\stockfish\stockfish.exe

# Mac example:
STOCKFISH_PATH=/usr/local/bin/stockfish

# Linux example:
STOCKFISH_PATH=/usr/bin/stockfish
```

To find where Stockfish is on Mac/Linux:
```
which stockfish
```

---

### 7. Start the backend

Make sure your venv is still active (you see `(venv)` in the prompt), then:

```bash
# Make sure you're in backend/
python app.py
```

You should see:
```
 * Running on http://127.0.0.1:5000
 * Debug mode: on
```

Leave this terminal open.

---

### 8. Set up the React frontend

Open a **new** terminal window (keep the backend one running):

```bash
cd chess-trainer/frontend

# Install all JavaScript packages (takes 1-2 minutes)
npm install

# Start the frontend
npm start
```

Your browser should open automatically at http://localhost:3000

If it doesn't, open your browser and go to: http://localhost:3000

---

## Using the app

1. Type any **Lichess** username in the top bar (e.g. `DrNykterstein` or your own username)
2. Click **Analyze** — it fetches their last 50 games (takes ~5 seconds)
3. Go to the **Analysis** tab to see opening stats and win rates
4. Go back to **Training** tab — toggle "Train vs [username]" ON to play against the bot
5. Ask the chatbot anything: *"What opening should I play against this person?"*

---

## Common problems

**"pip is not recognized"**
Try: `python -m pip install -r requirements.txt`

**"Module not found" error**
Make sure your venv is activated. You should see `(venv)` in the terminal.

**"No games found"**
The username must be a Lichess username (not Chess.com). Try: `hikaru`, `Magnus`, or your own Lichess account.

**Stockfish errors / bot doesn't move**
Double-check the `STOCKFISH_PATH` in your `.env` file. The path must point to the actual executable file, not just the folder.

**CORS error in browser**
Make sure the Flask backend is running on port 5000 and the React app is on port 3000. The `proxy` setting in `package.json` handles the connection.

**Port 5000 already in use (Mac)**
Mac uses port 5000 for AirPlay. Either disable AirPlay Receiver in System Settings → General → AirDrop & Handoff, or change the port in `app.py` to `5001` and update `package.json` proxy to `http://localhost:5001`.

---

## File structure (for reference)

```
chess-trainer/
├── backend/
│   ├── app.py          ← Flask server (run this)
│   ├── fetcher.py      ← Lichess API calls
│   ├── analyzer.py     ← PGN parsing + Stockfish analysis
│   ├── bot.py          ← Training bot logic
│   ├── requirements.txt
│   └── .env            ← Your API keys (never commit this)
│
└── frontend/
    ├── package.json
    └── src/
        ├── App.js              ← Main layout
        ├── components/
        │   ├── Board.js        ← Chessboard + bot moves
        │   ├── Chatbot.js      ← AI coach chat
        │   ├── Analysis.js     ← Stats + charts
        │   └── UsernameBar.js  ← Username input
        └── index.js
```
