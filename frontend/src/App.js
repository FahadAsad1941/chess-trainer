import React, { useState } from "react";
import Board from "./components/Board";
import Chatbot from "./components/Chatbot";
import Analysis from "./components/Analysis";
import UsernameBar from "./components/UsernameBar";
import OpeningRecommendations from "./components/OpeningRecommendations";
import "./App.css";

export default function App() {
  const [targetUser, setTargetUser] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [activeTab, setActiveTab] = useState("train");
  const [playerColor, setPlayerColor] = useState("white");

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">♞ Chess Trainer</div>
        <UsernameBar onAnalyzed={(user, data) => { setTargetUser(user); setAnalysisData(data); }} />
        <div className="tabs">
          <button className={activeTab === "train" ? "tab active" : "tab"} onClick={() => setActiveTab("train")}>⚔ Training</button>
          <button className={activeTab === "analyze" ? "tab active" : "tab"} onClick={() => setActiveTab("analyze")}>📊 Analysis</button>
        </div>
      </header>

      {targetUser && (
        <div className="player-banner">
          Studying <span className="player-name">{targetUser}</span>
          {analysisData && <span className="player-games"> · {analysisData.total_games} games analyzed</span>}
        </div>
      )}

      <main className="app-body">
        {activeTab === "train" ? (
          <div className="train-layout">
            <div className="train-top">
              <Board targetUser={targetUser} onColorChange={setPlayerColor} />
              <div className="chat-col">
                <Chatbot targetUser={targetUser} />
              </div>
            </div>
            <OpeningRecommendations
              targetUser={targetUser}
              analysisData={analysisData}
              playerColor={playerColor}
            />
          </div>
        ) : (
          <Analysis data={analysisData} targetUser={targetUser} />
        )}
      </main>

      <footer className="app-footer">Chess Trainer · AI Course Project</footer>
    </div>
  );
}