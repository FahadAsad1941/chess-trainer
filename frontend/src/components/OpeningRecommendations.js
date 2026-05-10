import React, { useState, useEffect, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import axios from "axios";
import "./OpeningRecommendations.css";

export default function OpeningRecommendations({ targetUser, analysisData }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [boardStates, setBoardStates] = useState({});
  const intervalsRef = useRef({});

  useEffect(() => {
    if (!targetUser || !analysisData) return;
    fetchRecommendations();
    return () => Object.values(intervalsRef.current).forEach(clearInterval);
  }, [targetUser]);

  async function fetchRecommendations() {
    setLoading(true);
    setRecommendations([]);
    setBoardStates({});
    try {
      const res = await axios.post("/api/recommend-openings", {
        username: targetUser,
        opening_stats: analysisData.opening_stats,
      });
      const recs = res.data.recommendations;
      setRecommendations(recs);
      const states = {};
      recs.forEach((_, i) => {
        states[i] = { fen: new Chess().fen(), moveIndex: 0 };
      });
      setBoardStates(states);
    } catch (err) {
      console.error("Failed to fetch recommendations", err);
    } finally {
      setLoading(false);
    }
  }

  function getMoves(moves_str) {
    // Parse "1.e4 e5 2.Nf3 Nc6" -> ["e4","e5","Nf3","Nc6"]
    return moves_str
      .trim()
      .replace(/\d+\./g, " ")
      .trim()
      .split(/\s+/)
      .filter(m => m.length > 0);
  }

  function buildFenAtMove(moves_str, moveIndex) {
    const moves = getMoves(moves_str);
    const g = new Chess();
    for (let i = 0; i < moveIndex && i < moves.length; i++) {
      try {
        g.move(moves[i]);
      } catch (_) {
        break;
      }
    }
    return g.fen();
  }

  function setMoveIndex(index, newMoveIndex, moves_str) {
    const moves = getMoves(moves_str);
    const clamped = Math.max(0, Math.min(newMoveIndex, moves.length));
    const fen = buildFenAtMove(moves_str, clamped);
    setBoardStates(prev => ({
      ...prev,
      [index]: { fen, moveIndex: clamped }
    }));
  }

  function resetBoard(index) {
    clearInterval(intervalsRef.current[index]);
    setBoardStates(prev => ({
      ...prev,
      [index]: { fen: new Chess().fen(), moveIndex: 0 }
    }));
  }

  function stepBack(index, moves_str) {
    clearInterval(intervalsRef.current[index]);
    const cur = boardStates[index];
    if (!cur || cur.moveIndex <= 0) return;
    setMoveIndex(index, cur.moveIndex - 1, moves_str);
  }

  function stepForward(index, moves_str) {
    clearInterval(intervalsRef.current[index]);
    const moves = getMoves(moves_str);
    const cur = boardStates[index];
    if (!cur || cur.moveIndex >= moves.length) return;
    setMoveIndex(index, cur.moveIndex + 1, moves_str);
  }

  function playAll(index, moves_str) {
    clearInterval(intervalsRef.current[index]);
    const moves = getMoves(moves_str);
    let current = boardStates[index]?.moveIndex || 0;

    // If already at end, reset first
    if (current >= moves.length) {
      current = 0;
      setMoveIndex(index, 0, moves_str);
    }

    intervalsRef.current[index] = setInterval(() => {
      current += 1;
      if (current > moves.length) {
        clearInterval(intervalsRef.current[index]);
        return;
      }
      const fen = buildFenAtMove(moves_str, current);
      setBoardStates(prev => ({
        ...prev,
        [index]: { fen, moveIndex: current }
      }));
    }, 800);
  }

  if (!targetUser || !analysisData) return null;

  return (
    <div className="recommendations-section">
      <div className="rec-title">🎯 Recommended Openings vs {targetUser}</div>
      {loading && <div className="rec-loading">AI is analyzing weaknesses…</div>}
      {recommendations.map((rec, i) => {
        const moves = getMoves(rec.moves);
        const cur = boardStates[i];
        return (
          <div className="rec-card" key={i}>

            {/* LEFT: number + board + controls */}
            <div className="rec-board-col">
              <div className="rec-number">#{i + 1} RECOMMENDATION</div>
              <Chessboard
                position={cur?.fen || "start"}
                arePiecesDraggable={false}
                boardWidth={300}
                customDarkSquareStyle={{ backgroundColor: "#4a7c59" }}
                customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
                customBoardStyle={{ borderRadius: "6px", overflow: "hidden" }}
              />
              <div className="rec-board-info">
                {cur ? `Move ${cur.moveIndex} of ${moves.length}` : ""}
              </div>
              <div className="rec-controls">
                <button onClick={() => resetBoard(i)}>⏮</button>
                <button onClick={() => stepBack(i, rec.moves)}>◀</button>
                <button onClick={() => playAll(i, rec.moves)}>▶ Play</button>
                <button onClick={() => stepForward(i, rec.moves)}>▶|</button>
              </div>
            </div>

            {/* MIDDLE: name + moves + description */}
            <div className="rec-center-col">
              <div className="rec-name">{rec.name}</div>
              <div className="rec-moves">{rec.moves}</div>
              <div className="rec-desc">{rec.description}</div>
              <div className="rec-meta">
                <span><strong>Difficulty:</strong> {rec.difficulty}</span>
                <span><strong>Famous players:</strong> {rec.famous_players}</span>
              </div>
            </div>

          </div>
        );
      })}
    </div>
  );
}