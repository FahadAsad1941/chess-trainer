import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./Chatbot.css";

export default function Chatbot({ targetUser }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! Enter a Chess.com username above and click Analyze. Then ask me anything — what openings to prepare, their weaknesses, how to beat them.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (targetUser) {
      setMessages([{
        role: "assistant",
        content: `Got it! I've analyzed ${targetUser}'s games. Ask me anything — what openings they play, where they struggle, or what you should prepare.`,
      }]);
    }
  }, [targetUser]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post("/api/chat", {
        username: targetUser || "",
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
      });
      setMessages([...newMessages, { role: "assistant", content: res.data.reply }]);
    } catch (err) {
      const errMsg = err.response?.data?.error || "Backend error — make sure python app.py is running.";
      setMessages([...newMessages, { role: "assistant", content: `Error: ${errMsg}` }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="chat-panel card">
      <div className="chat-header">
        🤖 AI Coach
        {targetUser && <span className="chat-user"> — studying {targetUser}</span>}
      </div>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`msg ${msg.role}`}>
            <div className="msg-bubble">{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className="msg assistant">
            <div className="msg-bubble typing">Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          className="chat-input"
          placeholder="Ask about openings, weaknesses, strategy…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={2}
          disabled={loading}
        />
        <button className="send-btn" onClick={sendMessage} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}