import React, { useState, useCallback, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import axios from "axios";
import "./Board.css";

// Move classification thresholds
function classifyMove(prevEval, newEval, isWhite) {
  const delta = isWhite ? (newEval - prevEval) : (prevEval - newEval);
  if (delta >= 150) return { label: "Brilliant", emoji: "✨", cls: "brilliant" };
  if (delta >= 50) return { label: "Good", emoji: "✓", cls: "good" };
  if (delta >= -30) return { label: "Inaccuracy", emoji: "?!", cls: "inaccuracy" };
  if (delta >= -150) return { label: "Mistake", emoji: "?", cls: "mistake" };
  return { label: "Blunder", emoji: "??", cls: "blunder" };
}

function EvalBar({ score, orientation }) {
  // score in centipawns, positive = white winning
  const clamped = Math.max(-1000, Math.min(1000, score || 0));
  const whitePercent = 50 + (clamped / 1000) * 45;
  const blackPercent = 100 - whitePercent;
  const displayScore = Math.abs(clamped / 100).toFixed(1);
  const winning = clamped > 0 ? "White" : "Black";

  return (
    <div className="eval-bar-wrap" title={`${winning} +${displayScore}`}>
      <div className="eval-bar">
        <div
          className="eval-white"
          style={{
            height: orientation === "white" ? `${whitePercent}%` : `${blackPercent}%`,
            transition: "height 0.5s ease"
          }}
        />
      </div>
      <div className="eval-score">{clamped > 0 ? "+" : ""}{(clamped / 100).toFixed(1)}</div>
    </div>
  );
}

export default function Board({ targetUser, onColorChange }) {
  const [game, setGame] = useState(new Chess());
  const [playerColor, setPlayerColor] = useState("white");
  const [status, setStatus] = useState("Analyze a user to start training");
  const [trainingMode, setTrainingMode] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [moveFrom, setMoveFrom] = useState(null);
  const [optionSquares, setOptionSquares] = useState({});
  const [lastMove, setLastMove] = useState(null);
  const [botStarted, setBotStarted] = useState(false);
  const [moveHistory, setMoveHistory] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [resigned, setResigned] = useState(false);
  const [evalScore, setEvalScore] = useState(0);
  const [stockfishLevel, setStockfishLevel] = useState(null);
  const [moveClassifications, setMoveClassifications] = useState([]);
  const [lastClassification, setLastClassification] = useState(null);

  // Fetch stockfish level info when user is analyzed
  useEffect(() => {
    if (targetUser) {
      setStatus("Ready — enable Training Mode to play");
    }
  }, [targetUser]);

  function playSound(isCapture) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = isCapture ? 320 : 440;
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      o.start(); o.stop(ctx.currentTime + 0.15);
    } catch (_) {}
  }

  function getStatus(g) {
    if (g.isCheckmate()) return "♚ Checkmate!";
    if (g.isDraw()) return "½ Draw";
    if (g.isCheck()) return "⚠ Check!";
    return g.turn() === "w" ? "White to move" : "Black to move";
  }

  function getMoveOptions(square, g) {
    const moves = g.moves({ square, verbose: true });
    if (!moves.length) return {};
    const squares = {};
    moves.forEach(m => {
      const isCapture = g.get(m.to);
      squares[m.to] = {
        background: isCapture
          ? "radial-gradient(circle, rgba(255,0,0,0.5) 60%, transparent 65%)"
          : "radial-gradient(circle, rgba(0,0,0,0.4) 28%, transparent 32%)",
        borderRadius: "50%",
      };
    });
    squares[square] = { background: "rgba(200,169,110,0.3)" };
    return squares;
  }

  function getArrows() {
    if (!lastMove) return [];
    return [[lastMove.from, lastMove.to, "rgba(200,169,110,0.7)"]];
  }

  function flipBoard() {
    const newColor = playerColor === "white" ? "black" : "white";
    setPlayerColor(newColor);
    if (onColorChange) onColorChange(newColor);
    setBotStarted(false);
    setAnalysis(null);
  }

  async function handleBotStart() {
    if (!trainingMode || !targetUser || botStarted) return;
    setBotStarted(true);
    await handleBotMove(game);
  }

  function resign() {
    if (resigned || game.isGameOver()) return;
    setResigned(true);
    setStatus(`You resigned. ${targetUser || "Opponent"} wins!`);
    setAnalysis(null);
  }

  async function analyzeGame() {
    if (moveHistory.length === 0) return;
    setAnalysisLoading(true);
    setAnalysis(null);
    try {
      const res = await axios.post("/api/chat", {
        username: targetUser || "",
        messages: [{
          role: "user",
          content: `Analyze this chess game. Moves: ${moveHistory.join(", ")}. 
I played as ${playerColor}${targetUser ? ` against a bot simulating ${targetUser}` : ""}. 
Give: 1) Key mistakes, 2) Good moves I played, 3) What to improve. Be concise and specific.`
        }]
      });
      setAnalysis(res.data.reply);
    } catch {
      setAnalysis("Could not analyze game. Try again.");
    } finally {
      setAnalysisLoading(false);
    }
  }

  // Simple material-based eval for the eval bar
  function quickEval(g) {
    const vals = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
    let score = 0;
    for (const [, piece] of Object.entries(g.board().flat().filter(Boolean).reduce((a, p) => { a[Math.random()] = p; return a; }, {}))) {
      if (!piece) continue;
      const v = vals[piece.type] || 0;
      score += piece.color === 'w' ? v : -v;
    }
    return score;
  }

  function evalBoard(g) {
    const vals = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
    let score = 0;
    const board = g.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        const v = vals[p.type] || 0;
        score += p.color === 'w' ? v : -v;
      }
    }
    if (g.isCheckmate()) return g.turn() === 'w' ? -9999 : 9999;
    if (g.isDraw()) return 0;
    return score;
  }

  function onSquareClick(square) {
    if (thinking || resigned || game.isGameOver()) return;
    if (playerColor === "black" && game.turn() === "w") return;
    if (playerColor === "white" && game.turn() === "b") return;

    if (moveFrom) {
      const gameCopy = new Chess(game.fen());
      let move = null;
      try { move = gameCopy.move({ from: moveFrom, to: square }); }
      catch (_) {
        try { move = gameCopy.move({ from: moveFrom, to: square, promotion: "q" }); }
        catch (_) {}
      }

      if (move) {
        const prevEval = evalBoard(game);
        const newEval = evalBoard(gameCopy);
        const classification = classifyMove(prevEval, newEval, game.turn() === 'w');
        setLastClassification(classification);
        setMoveClassifications(prev => [...prev, { move: move.san, ...classification }]);
        setEvalScore(newEval);

        playSound(move.flags.includes('c'));
        setLastMove({ from: moveFrom, to: square });
        setGame(gameCopy);
        setMoveHistory(prev => [...prev, move.san]);
        setMoveFrom(null);
        setOptionSquares({});
        setStatus(getStatus(gameCopy));
        setTimeout(() => setLastClassification(null), 2000);
        if (!gameCopy.isGameOver()) handleBotMove(gameCopy);
        return;
      }

      const piece = game.get(square);
      if (piece && piece.color === game.turn()[0]) {
        setMoveFrom(square);
        setOptionSquares(getMoveOptions(square, game));
        return;
      }
      setMoveFrom(null);
      setOptionSquares({});
      return;
    }

    const piece = game.get(square);
    if (!piece) return;
    if (piece.color !== game.turn()[0]) return;
    setMoveFrom(square);
    setOptionSquares(getMoveOptions(square, game));
  }

  const onDrop = useCallback(async (sourceSquare, targetSquare) => {
    if (thinking || resigned || game.isGameOver()) return false;
    if (playerColor === "black" && game.turn() === "w") return false;
    if (playerColor === "white" && game.turn() === "b") return false;

    const gameCopy = new Chess(game.fen());
    let move = null;
    try { move = gameCopy.move({ from: sourceSquare, to: targetSquare }); }
    catch (_) {
      try { move = gameCopy.move({ from: sourceSquare, to: targetSquare, promotion: "q" }); }
      catch (_) { return false; }
    }
    if (!move) return false;

    const prevEval = evalBoard(game);
    const newEval = evalBoard(gameCopy);
    const classification = classifyMove(prevEval, newEval, game.turn() === 'w');
    setLastClassification(classification);
    setMoveClassifications(prev => [...prev, { move: move.san, ...classification }]);
    setEvalScore(newEval);

    playSound(move.flags.includes('c'));
    setLastMove({ from: sourceSquare, to: targetSquare });
    setMoveFrom(null);
    setOptionSquares({});
    setGame(gameCopy);
    setMoveHistory(prev => [...prev, move.san]);
    setStatus(getStatus(gameCopy));
    setTimeout(() => setLastClassification(null), 2000);
    if (!gameCopy.isGameOver()) handleBotMove(gameCopy);
    return true;
  }, [game, trainingMode, targetUser, thinking, playerColor, resigned]);

  async function handleBotMove(currentGame) {
    if (!trainingMode || !targetUser) return;
    const botTurn = playerColor === "white" ? "b" : "w";
    if (currentGame.turn() !== botTurn) return;
    setThinking(true);
    setStatus("Bot thinking…");
    try {
      const { data } = await axios.post("/api/bot-move", {
        username: targetUser,
        fen: currentGame.fen(),
      });

      // Show stockfish level from response if available
      if (data.skill_level !== undefined) setStockfishLevel(data.skill_level);

      if (data.move) {
        const botGame = new Chess(currentGame.fen());
        const from = data.move.slice(0, 2);
        const to = data.move.slice(2, 4);
        const promo = data.move[4] || "q";
        try {
          const botMove = botGame.move({ from, to, promotion: promo });
          playSound(false);
          setLastMove({ from, to });
          setEvalScore(evalBoard(botGame));
          setGame(botGame);
          if (botMove) setMoveHistory(prev => [...prev, botMove.san]);
          setStatus(getStatus(botGame));
        } catch (_) {}
      }
    } catch (_) {
      setStatus(getStatus(currentGame));
    } finally {
      setThinking(false);
    }
  }

  function resetGame() {
    setGame(new Chess());
    setStatus(targetUser ? "Ready — enable Training Mode to play" : "Analyze a user to start training");
    setThinking(false);
    setMoveFrom(null);
    setOptionSquares({});
    setLastMove(null);
    setBotStarted(false);
    setMoveHistory([]);
    setAnalysis(null);
    setResigned(false);
    setEvalScore(0);
    setMoveClassifications([]);
    setLastClassification(null);
  }

  function kingSquare() {
    if (!game.isCheck()) return {};
    const board = game.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === "k" && p.color === game.turn()[0]) {
          const file = String.fromCharCode(97 + c);
          const rank = 8 - r;
          return { [`${file}${rank}`]: { background: "rgba(220,50,50,0.5)" } };
        }
      }
    }
    return {};
  }

  const customSquareStyles = { ...optionSquares, ...kingSquare() };
  const showStartButton = trainingMode && targetUser && playerColor === "black" && !botStarted && !resigned && !game.isGameOver();
  const gameOver = game.isGameOver() || resigned;

  // Count move types
  const moveCounts = moveClassifications.reduce((acc, m) => {
    acc[m.cls] = (acc[m.cls] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="board-panel card">
      {/* Controls */}
      <div className="board-controls">
        <button className="ctrl-btn" onClick={resetGame}>↺ Reset</button>
        <button className="ctrl-btn" onClick={flipBoard}>⇅ Flip</button>
        {trainingMode && !gameOver && (
          <button className="ctrl-btn resign-btn" onClick={resign}>🏳 Resign</button>
        )}
        {moveHistory.length > 0 && (
          <button className="ctrl-btn analyze-btn-ctrl" onClick={analyzeGame} disabled={analysisLoading}>
            {analysisLoading ? <><span className="loading-spinner" style={{width:12,height:12}} /> Analyzing…</> : "📝 Analyze"}
          </button>
        )}
        <label className={`toggle-label ${trainingMode ? "active-train" : ""}`}>
          <input
            type="checkbox"
            checked={trainingMode}
            onChange={e => { setTrainingMode(e.target.checked); setBotStarted(false); setAnalysis(null); }}
            disabled={!targetUser}
          />
          {targetUser ? `vs ${targetUser}` : "Analyze user first"}
        </label>
      </div>

      {/* Stockfish level badge */}
      {trainingMode && targetUser && (
        <div className="sf-level-bar">
          <span className="sf-label">Engine</span>
          <span className="sf-badge">Stockfish</span>
          {stockfishLevel !== null && (
            <span className="sf-level">Skill {stockfishLevel}/20</span>
          )}
          <span className="sf-elo-hint">{targetUser}'s level</span>
        </div>
      )}

      {/* Board + Eval bar */}
      <div className="board-with-eval">
        <EvalBar score={evalScore} orientation={playerColor} />
        <div className="board-wrap">
          <Chessboard
            position={game.fen()}
            onPieceDrop={onDrop}
            onSquareClick={onSquareClick}
            boardOrientation={playerColor}
            customSquareStyles={customSquareStyles}
            customArrows={getArrows()}
            customBoardStyle={{ borderRadius: "8px", overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}
            customDarkSquareStyle={{ backgroundColor: "#3d6b4f" }}
            customLightSquareStyle={{ backgroundColor: "#d4b896" }}
            arePiecesDraggable={!thinking && !resigned && !game.isGameOver()}
          />
        </div>
      </div>

      {/* Move classification toast */}
      {lastClassification && (
        <div className={`classification-toast ${lastClassification.cls}`}>
          <span className="classification-emoji">{lastClassification.emoji}</span>
          <span className="classification-label">{lastClassification.label}</span>
        </div>
      )}

      {showStartButton && (
        <button className="start-btn" onClick={handleBotStart}>
          ▶ Start — Let {targetUser} play first as White
        </button>
      )}

      <div className={`board-status ${game.isCheck() ? "check" : thinking ? "thinking" : game.isGameOver() || resigned ? "gameover" : ""}`}>
        {thinking && <span className="loading-spinner" style={{width:12,height:12,marginRight:6}} />}
        {status}
      </div>

      {/* Move summary bar */}
      {moveClassifications.length > 0 && (
        <div className="move-summary">
          {moveCounts.brilliant > 0 && <span className="ms-tag brilliant">✨ {moveCounts.brilliant}</span>}
          {moveCounts.good > 0 && <span className="ms-tag good">✓ {moveCounts.good}</span>}
          {moveCounts.inaccuracy > 0 && <span className="ms-tag inaccuracy">?! {moveCounts.inaccuracy}</span>}
          {moveCounts.mistake > 0 && <span className="ms-tag mistake">? {moveCounts.mistake}</span>}
          {moveCounts.blunder > 0 && <span className="ms-tag blunder">?? {moveCounts.blunder}</span>}
        </div>
      )}

      {/* Move history */}
      {moveHistory.length > 0 && (
        <div className="move-history">
          {moveHistory.map((m, i) => {
            const cls = moveClassifications[i]?.cls;
            return (
              <span key={i} className={`move-token ${cls || ""}`}>
                {i % 2 === 0 && <span className="move-num">{Math.floor(i / 2) + 1}.</span>}
                {m}
                {cls && <span className="move-badge">{moveClassifications[i]?.emoji}</span>}
              </span>
            );
          })}
        </div>
      )}

      {/* Game analysis */}
      {analysis && (
        <div className="game-analysis">
          <div className="analysis-header">📝 AI Game Analysis</div>
          <div className="analysis-text">{analysis}</div>
        </div>
      )}
    </div>
  );
}
