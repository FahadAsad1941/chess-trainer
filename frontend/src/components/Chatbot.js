import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./Chatbot.css";

export default function Chatbot({ targetUser, currentFen }) {
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "Analyze a Chess.com username above, then ask me anything — their weaknesses, what openings to play, how to exploit their patterns.",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (targetUser) {
      setMessages([{
        role: "assistant",
        content: `Ready! I've analyzed **${targetUser}**'s games. Ask me:\n• What openings do they play?\n• Where do they make mistakes?\n• How should I handle their style?\n• What's the best prep against them?`,
      }]);
    }
  }, [targetUser]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    // Append FEN context if board position available
    const contextText = currentFen && currentFen !== "start"
      ? `${text}\n\n[Current position FEN: ${currentFen}]`
      : text;

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post("/api/chat", {
        username: targetUser || "",
        messages: [
          ...newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
          { role: "user", content: contextText }
        ],
      });
      setMessages([...newMessages, { role: "assistant", content: res.data.reply }]);
    } catch (err) {
      const errMsg = err.response?.data?.error || "Backend error.";
      setMessages([...newMessages, { role: "assistant", content: `Error: ${errMsg}` }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function formatMessage(content) {
    // Bold **text**
    return content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  }

  return (
    <div className="chat-panel card">
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="chat-icon">🤖</span>
          <div>
            <div className="chat-title">AI Coach</div>
            {targetUser && <div className="chat-sub">Studying {targetUser}</div>}
          </div>
        </div>
        <div className="chat-status-dot" title="Online" />
      </div>

      <div className="chat-messages" ref={chatRef}>
        {messages.map((msg, i) => (
          <div key={i} className={`msg ${msg.role}`}>
            {msg.role === "assistant" && <div className="msg-avatar">♟</div>}
            <div
              className="msg-bubble"
              dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
            />
          </div>
        ))}
        {loading && (
          <div className="msg assistant">
            <div className="msg-avatar">♟</div>
            <div className="msg-bubble typing">
              <span /><span /><span />
            </div>
          </div>
        )}
      </div>

      <div className="chat-input-row">
        <textarea
          className="chat-input"
          placeholder={targetUser ? `Ask about ${targetUser}…` : "Analyze a user first…"}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={2}
          disabled={loading}
        />
        <button className="send-btn" onClick={sendMessage} disabled={loading || !input.trim()}>
          {loading ? <span className="loading-spinner" style={{width:14,height:14}} /> : "↑"}
        </button>
      </div>
    </div>
  );
}
