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
        states[i] = { game: new Chess(), moveIndex: 0 };
      });
      setBoardStates(states);
    } catch (err) {
      console.error("Failed to fetch recommendations", err);
    } finally {
      setLoading(false);
    }
  }

  // Parse "1.e4 e5 2.Nf3 Nc6" into ["e4","e5","Nf3","Nc6"]
  function getMoves(moves_str) {
    return moves_str
      .trim()
      .split(/\s+/)
      .filter(m => !/^\d+\./.test(m))
      .filter(m => m.length > 0);
  }

  function goToMove(index, moveIndex, moves_str) {
    const moves = getMoves(moves_str);
    const g = new Chess();
    for (let i = 0; i < moveIndex && i < moves.length; i++) {
      try { g.move(moves[i]); } catch (_) {}
    }
    setBoardStates(prev => ({
      ...prev,
      [index]: { game: g, moveIndex }
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

  function resetBoard(index) {
    clearInterval(intervalsRef.current[index]);
    setBoardStates(prev => ({
      ...prev,
      [index]: { game: new Chess(), moveIndex: 0 }
    }));
  }

  function playAll(index, moves_str) {
    clearInterval(intervalsRef.current[index]);
    const moves = getMoves(moves_str);
    let i = boardStates[index]?.moveIndex || 0;
    intervalsRef.current[index] = setInterval(() => {
      if (i >= moves.length) {
        clearInterval(intervalsRef.current[index]);
        return;
      }
      i++;
      goToMove(index, i, moves_str);
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
                position={cur?.game.fen() || "start"}
                arePiecesDraggable={false}
                boardWidth={220}
                customDarkSquareStyle={{ backgroundColor: "#4a7c59" }}
                customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
                customBoardStyle={{ borderRadius: "4px", overflow: "hidden" }}
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
          </div>
        );
      })}
    </div>
  );
}