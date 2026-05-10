import React, { useState } from "react";
import Board from "./components/Board";
import Chatbot from "./components/Chatbot";
import Analysis from "./components/Analysis";
import UsernameBar from "./components/UsernameBar";
import "./App.css";

export default function App() {
  // Shared state: the analyzed player
  const [targetUser, setTargetUser] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [activeTab, setActiveTab] = useState("train"); // "train" | "analyze"

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">♞ Chess Trainer</div>
        <UsernameBar onAnalyzed={(user, data) => { setTargetUser(user); setAnalysisData(data); }} />
        <div className="tabs">
          <button className={activeTab === "train" ? "tab active" : "tab"} onClick={() => setActiveTab("train")}>Training</button>
          <button className={activeTab === "analyze" ? "tab active" : "tab"} onClick={() => setActiveTab("analyze")}>Analysis</button>
        </div>
      </header>

      <main className="app-body">
        {activeTab === "train" ? (
          <div className="train-layout">
            <Board targetUser={targetUser} />
            <Chatbot targetUser={targetUser} />
          </div>
        ) : (
          <Analysis data={analysisData} targetUser={targetUser} />
        )}
      </main>
    </div>
  );
}
