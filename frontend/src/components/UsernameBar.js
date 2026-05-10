import React, { useState } from "react";
import axios from "axios";
import "./UsernameBar.css";

export default function UsernameBar({ onAnalyzed }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await axios.post("/api/analyze", {
        username: input.trim(),
        max_games: 50,
      });
      setSuccess(`✓ ${data.total_games} games loaded`);
      onAnalyzed(input.trim(), data);
    } catch (err) {
      const msg = err.response?.data?.error || "Could not fetch games. Check the username and make sure the backend is running.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="username-bar" onSubmit={handleSubmit}>
      <input
        className="username-input"
        type="text"
        placeholder="Enter Chess.com username…"
        value={input}
        onChange={e => { setInput(e.target.value); setError(""); setSuccess(""); }}
        disabled={loading}
      />
      <button className="analyze-btn" type="submit" disabled={loading}>
        {loading ? "Analyzing…" : "Analyze"}
      </button>
      {error && <span className="username-error">{error}</span>}
      {success && <span className="username-success">{success}</span>}
    </form>
  );
}