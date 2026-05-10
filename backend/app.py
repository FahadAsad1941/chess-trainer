from dotenv import load_dotenv
load_dotenv()

import os
import json as json_lib
import chess
from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq

from fetcher import fetch_games_pgn
from analyzer import parse_games, get_opening_stats, build_player_summary
from bot import build_opening_book, get_bot_move

app = Flask(__name__)
CORS(app)

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
_cache = {}
STOCKFISH_PATH = os.environ.get("STOCKFISH_PATH", "stockfish")


@app.route("/api/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    username = data.get("username", "").strip()
    max_games = int(data.get("max_games", 50))
    if not username:
        return jsonify({"error": "username is required"}), 400
    try:
        pgn_text = fetch_games_pgn(username, max_games)
        games = parse_games(pgn_text)
        if not games:
            return jsonify({"error": f"No games found for '{username}' on Chess.com"}), 404
        opening_stats = get_opening_stats(games, username)
        summary = build_player_summary(username, opening_stats, len(games))
        opening_book = build_opening_book(games, username)
        _cache[username] = {"opening_stats": opening_stats, "summary": summary, "opening_book": opening_book}
        return jsonify({"username": username, "total_games": len(games), "opening_stats": opening_stats[:20], "summary": summary})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    username = data.get("username", "").strip()
    messages = data.get("messages", [])
    if not messages:
        return jsonify({"error": "messages required"}), 400

    if username and username in _cache:
        system = f"You are an expert chess coach helping a player prepare against {username}.\n\nOpponent analysis:\n{_cache[username]['summary']}\n\nGive specific, actionable advice based on this data."
    else:
        system = "You are an expert chess coach. Give practical, specific advice to help the player improve."

    try:
        groq_messages = [{"role": "system", "content": system}]
        for msg in messages:
            groq_messages.append({"role": msg["role"], "content": msg["content"]})

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=groq_messages,
            max_tokens=1000,
        )
        return jsonify({"reply": response.choices[0].message.content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/bot-move", methods=["POST"])
def bot_move():
    data = request.get_json()
    username = data.get("username", "").strip()
    fen = data.get("fen", "").strip()
    if not fen:
        return jsonify({"error": "fen required"}), 400
    opening_book = _cache.get(username, {}).get("opening_book", {})
    try:
        board = chess.Board(fen)
        move = get_bot_move(board, opening_book, STOCKFISH_PATH)
        return jsonify({"move": move})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/recommend-openings", methods=["POST"])
def recommend_openings():
    data = request.json
    username = data.get("username", "")
    opening_stats = data.get("opening_stats", [])

    weak = [o for o in opening_stats if o["win_rate"] < 45 and o["total"] >= 2]
    weak_summary = "\n".join([
        f"- {o['opening']}: {o['win_rate']}% win rate in {o['total']} games"
        for o in weak[:6]
    ])

    if not weak_summary:
        weak_summary = "No clear weaknesses found, recommend solid universal openings."

    prompt = f"""You are a chess coach. The player {username} struggles against these openings:
{weak_summary}

Recommend exactly 3 openings to play AGAINST {username} to exploit their weaknesses.
Respond ONLY with valid JSON array, no markdown, no explanation:
[
  {{
    "name": "Opening Name",
    "moves": "1.e4 e5 2.Nf3 Nc6",
    "description": "One sentence why this works against this player.",
    "difficulty": "Beginner/Intermediate/Advanced",
    "famous_players": "Player1, Player2, Player3"
  }}
]"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a chess coach. Always respond with valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=800,
        )
        text = response.choices[0].message.content.strip()
        text = text.replace("```json", "").replace("```", "").strip()
        recs = json_lib.loads(text)
        return jsonify({"recommendations": recs})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)