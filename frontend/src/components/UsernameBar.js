import React, { useState } from "react";
import axios from "axios";
import "./UsernameBar.css";

export default function UsernameBar({ onAnalyzed }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [progress, setProgress] = useState(0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    setLoading(true);
    setError("");
    setSuccess("");
    setProgress(0);

    // Animate progress bar while waiting
    const interval = setInterval(() => {
      setProgress(p => p < 85 ? p + Math.random() * 8 : p);
    }, 400);

    try {
      const { data } = await axios.post("/api/analyze", {
        username: input.trim(),
        max_games: 50,
      }, { timeout: 20000 });

      setProgress(100);
      setTimeout(() => setProgress(0), 800);
      setSuccess(`✓ ${data.total_games} games loaded`);
      onAnalyzed(input.trim(), data);
    } catch (err) {
      setProgress(0);
      if (err.code === "ECONNABORTED") {
        setError("Request timed out. Try again.");
      } else if (err.response?.status === 404) {
        setError(`User "${input.trim()}" not found on Chess.com`);
      } else {
        setError(err.response?.data?.error || "Could not fetch games.");
      }
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }

  return (
    <form className="username-bar" onSubmit={handleSubmit}>
      <div className="username-input-wrap">
        <span className="username-icon">♟</span>
        <input
          className="username-input"
          type="text"
          placeholder="Chess.com username…"
          value={input}
          onChange={e => { setInput(e.target.value); setError(""); setSuccess(""); }}
          disabled={loading}
          autoComplete="off"
        />
        {loading && <div className="loading-spinner" />}
      </div>

      <button className="analyze-btn" type="submit" disabled={loading || !input.trim()}>
        {loading ? "Analyzing…" : "Analyze"}
      </button>

      {error && <span className="username-msg error">{error}</span>}
      {success && <span className="username-msg success">{success}</span>}

      {loading && (
        <div className="progress-bar-wrap">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
      )}
    </form>
  );
}
