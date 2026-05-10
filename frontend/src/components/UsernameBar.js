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
      }, {
        timeout: 15000, // 15 second timeout — stops spinning forever
      });
      setSuccess(`✓ ${data.total_games} games loaded`);
      onAnalyzed(input.trim(), data);
    } catch (err) {
      if (err.code === "ECONNABORTED") {
        setError("Request timed out. Check your connection and try again.");
      } else if (err.response?.status === 404) {
        setError(`❌ "${input.trim()}" not found on Chess.com. Check the username and try again.`);
      } else if (err.response?.status === 500) {
        setError("Server error. Please try again in a moment.");
      } else {
        setError(err.response?.data?.error || "Could not fetch games. Check the username and try again.");
      }
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
        {loading ? (
          <span>Analyzing… <span className="spinner">⏳</span></span>
        ) : "Analyze"}
      </button>
      {error && <span className="username-error">{error}</span>}
      {success && <span className="username-success">{success}</span>}
    </form>
  );
}