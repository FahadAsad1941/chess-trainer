import React, { useState, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import axios from "axios";
import "./OpeningRecommendations.css";

export default function OpeningRecommendations({ targetUser, analysisData }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [boardStates, setBoardStates] = useState({});

  useEffect(() => {
    if (!targetUser || !analysisData) return;
    fetchRecommendations();
  }, [targetUser]);

  async function fetchRecommendations() {
    setLoading(true);
    try {
      const res = await axios.post("/api/recommend-openings", {
        username: targetUser,
        opening_stats: analysisData.opening_stats,
      });
      const recs = res.data.recommendations;
      setRecommendations(recs);
      // Init board states
      const states = {};
      recs.forEach((_, i) => {
        states[i] = { game: new Chess(), moveIndex: 0, playing: false };
      });
      setBoardStates(states);
    } catch (err) {
      console.error("Failed to fetch recommendations", err);
    } finally {
      setLoading(false);
    }
  }

  function getMoves(moves_str) {
    // Parse "1.d4 d5 2.c4 e6" into UCI-style list
    return moves_str.trim().split(/\s+/).filter(m => !/^\d+\./.test(m));
  }

  function goToMove(index, moveIndex, moves_str) {
    const moves = getMoves(moves_str);
    const g = new Chess();
    for (let i = 0; i < moveIndex && i < moves.length; i++) {
      try { g.move(moves[i]); } catch (_) {}
    }
    setBoardStates(prev => ({
      ...prev,
      [index]: { ...prev[index], game: g, moveIndex, playing: false }
    }));
  }

  function stepForward(index, moves_str) {
    const moves = getMoves(moves_str);
    const cur = boardStates[index];
    if (!cur || cur.moveIndex >= moves.length) return;
    goToMove(index, cur.moveIndex + 1, moves_str);
  }

  function stepBack(index, moves_str) {
    const cur = boardStates[index];
    if (!cur || cur.moveIndex <= 0) return;
    goToMove(index, cur.moveIndex - 1, moves_str);
  }

  function reset(index) {
    setBoardStates(prev => ({
      ...prev,
      [index]: { game: new Chess(), moveIndex: 0, playing: false }
    }));
  }

  function playAll(index, moves_str) {
    const moves = getMoves(moves_str);
    const cur = boardStates[index];
    if (!cur) return;
    let i = cur.moveIndex;
    const interval = setInterval(() => {
      if (i >= moves.length) { clearInterval(interval); return; }
      i++;
      goToMove(index, i, moves_str);
    }, 700);
  }

  if (!targetUser || !analysisData) return null;

  return (
    <div className="recommendations-section">
      <div className="rec-title">🎯 Recommended Openings vs {targetUser}</div>
      {loading && <div className="rec-loading">AI is analyzing weaknesses…</div>}
      {recommendations.map((rec, i) => (
        <div className="rec-card" key={i}>
          <div className="rec-left">
            <div className="rec-number">#{i + 1} RECOMMENDATION</div>
            <div className="rec-name">{rec.name}</div>
            <div className="rec-moves">{rec.moves}</div>
            <div className="rec-desc">{rec.description}</div>
            <div className="rec-meta">
              <span><strong>Difficulty:</strong> {rec.difficulty}</span>
              <span><strong>Famous players:</strong> {rec.famous_players}</span>
            </div>
          </div>
          <div className="rec-right">
            <Chessboard
              position={boardStates[i]?.game.fen() || "start"}
              arePiecesDraggable={false}
              boardWidth={200}
              customDarkSquareStyle={{ backgroundColor: "#4a7c59" }}
              customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
              customBoardStyle={{ borderRadius: "4px", overflow: "hidden" }}
            />
            <div className="rec-board-info">
              {boardStates[i] ? `Move ${boardStates[i].moveIndex} of ${getMoves(rec.moves).length}` : ""}
            </div>
            <div className="rec-controls">
              <button onClick={() => reset(i)}>⏮</button>
              <button onClick={() => stepBack(i, rec.moves)}>◀</button>
              <button onClick={() => playAll(i, rec.moves)}>▶ Play</button>
              <button onClick={() => stepForward(i, rec.moves)}>▶|</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}