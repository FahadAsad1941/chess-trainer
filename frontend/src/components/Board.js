import React, { useState, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import axios from "axios";
import "./Board.css";

export default function Board({ targetUser, onColorChange }) {
  const [game, setGame] = useState(new Chess());
  const [playerColor, setPlayerColor] = useState("white");
  const [status, setStatus] = useState("Your turn");
  const [trainingMode, setTrainingMode] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [moveFrom, setMoveFrom] = useState(null);
  const [optionSquares, setOptionSquares] = useState({});
  const [lastMove, setLastMove] = useState(null);
  const [botStarted, setBotStarted] = useState(false);

  function playSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 440;
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      o.start(); o.stop(ctx.currentTime + 0.12);
    } catch (_) {}
  }

  function getStatus(g) {
    if (g.isCheckmate()) return "Checkmate!";
    if (g.isDraw()) return "Draw";
    if (g.isCheck()) return "Check!";
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
          ? "radial-gradient(circle, rgba(0,0,0,0.25) 60%, transparent 65%)"
          : "radial-gradient(circle, rgba(0,0,0,0.2) 28%, transparent 32%)",
        borderRadius: "50%",
      };
    });
    squares[square] = { background: "rgba(200,184,106,0.4)" };
    return squares;
  }

  function getArrows() {
    if (!lastMove) return [];
    return [[lastMove.from, lastMove.to, "rgb(0,128,0)"]];
  }

  function flipBoard() {
    const newColor = playerColor === "white" ? "black" : "white";
    setPlayerColor(newColor);
    if (onColorChange) onColorChange(newColor);
    setBotStarted(false);
  }

  async function handleBotStart() {
    if (!trainingMode || !targetUser || botStarted) return;
    setBotStarted(true);
    await handleBotMove(game);
  }

  function onSquareClick(square) {
    if (thinking) return;
    // If playing as black, only allow moves when it's black's turn
    if (playerColor === "black" && game.turn() === "w") return;
    // If playing as white, only allow moves when it's white's turn
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
        playSound();
        setLastMove({ from: moveFrom, to: square });
        setGame(gameCopy);
        setMoveFrom(null);
        setOptionSquares({});
        setStatus(getStatus(gameCopy));
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
    if (thinking) return false;
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

    playSound();
    setLastMove({ from: sourceSquare, to: targetSquare });
    setMoveFrom(null);
    setOptionSquares({});
    setGame(gameCopy);
    setStatus(getStatus(gameCopy));
    if (!gameCopy.isGameOver()) handleBotMove(gameCopy);
    return true;
  }, [game, trainingMode, targetUser, thinking, playerColor]);

  async function handleBotMove(currentGame) {
    if (!trainingMode || !targetUser) return;
    setThinking(true);
    setStatus("Bot thinking…");
    try {
      const { data } = await axios.post("/api/bot-move", {
        username: targetUser,
        fen: currentGame.fen(),
      });
      if (data.move) {
        const botGame = new Chess(currentGame.fen());
        const from = data.move.slice(0, 2);
        const to = data.move.slice(2, 4);
        const promo = data.move[4] || "q";
        try {
          botGame.move({ from, to, promotion: promo });
          playSound();
          setLastMove({ from, to });
          setGame(botGame);
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
    setStatus("Your turn");
    setThinking(false);
    setMoveFrom(null);
    setOptionSquares({});
    setLastMove(null);
    setBotStarted(false);
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
  const showStartButton = trainingMode && targetUser && playerColor === "black" && !botStarted;
  return (
    <div className="board-panel card">
      <div className="board-controls">
        <button className="ctrl-btn" onClick={resetGame}>↺ Reset</button>
        <button className="ctrl-btn" onClick={flipBoard}>⇅ Flip</button>
        <label className={`toggle-label ${trainingMode ? "active-train" : ""}`}>
          <input
            type="checkbox"
            checked={trainingMode}
            onChange={e => { setTrainingMode(e.target.checked); setBotStarted(false); }}
            disabled={!targetUser}
          />
          {targetUser ? `Train vs ${targetUser}` : "Analyze a user first"}
        </label>
      </div>

      <Chessboard
        position={game.fen()}
        onPieceDrop={onDrop}
        onSquareClick={onSquareClick}
        boardOrientation={playerColor}
        customSquareStyles={customSquareStyles}
        customArrows={getArrows()}
        customBoardStyle={{ borderRadius: "6px", overflow: "hidden" }}
        customDarkSquareStyle={{ backgroundColor: "#4a7c59" }}
        customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
        arePiecesDraggable={!thinking}
      />

      {showStartButton && (
        <button className="start-btn" onClick={handleBotStart}>
          ▶ Start — Let {targetUser} play first
        </button>
      )}

      <div className={`board-status ${game.isCheck() ? "check" : thinking ? "thinking" : ""}`}>
        {status}
      </div>
    </div>
  );
}