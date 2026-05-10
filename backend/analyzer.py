import io
import chess
import chess.pgn

OPENING_BOOK = {
    ("e2e4",): "King's Pawn Opening",
    ("d2d4",): "Queen's Pawn Opening",
    ("c2c4",): "English Opening",
    ("g1f3",): "Reti Opening",
    ("b2b3",): "Larsen's Opening",
    ("f2f4",): "Bird's Opening",
    ("g2g3",): "King's Fianchetto Opening",
    ("e2e4", "c7c5"): "Sicilian Defense",
    ("e2e4", "e7e5"): "Open Game",
    ("e2e4", "e7e6"): "French Defense",
    ("e2e4", "c7c6"): "Caro-Kann Defense",
    ("e2e4", "d7d5"): "Scandinavian Defense",
    ("e2e4", "g8f6"): "Alekhine's Defense",
    ("e2e4", "d7d6"): "Pirc Defense",
    ("e2e4", "g7g6"): "Modern Defense",
    ("e2e4", "b8c6"): "Nimzowitsch Defense",
    ("d2d4", "d7d5"): "Closed Game",
    ("d2d4", "g8f6"): "Indian Defense",
    ("d2d4", "e7e6"): "Queen's Pawn Game",
    ("d2d4", "f7f5"): "Dutch Defense",
    ("d2d4", "c7c5"): "Benoni Defense",
    ("d2d4", "g7g6"): "Modern Defense (d4)",
    ("e2e4", "c7c5", "g1f3"): "Sicilian Defense - Open",
    ("e2e4", "c7c5", "b1c3"): "Sicilian Defense - Closed",
    ("e2e4", "c7c5", "g1f3", "d7d6"): "Sicilian Najdorf",
    ("e2e4", "c7c5", "g1f3", "b8c6"): "Sicilian Classical",
    ("e2e4", "c7c5", "g1f3", "e7e6"): "Sicilian Scheveningen",
    ("e2e4", "c7c5", "g1f3", "g7g6"): "Sicilian Dragon",
    ("e2e4", "e7e5", "g1f3"): "King's Knight Opening",
    ("e2e4", "e7e5", "g1f3", "b8c6"): "Three Knights / Italian / Spanish",
    ("e2e4", "e7e5", "g1f3", "b8c6", "f1b5"): "Ruy Lopez (Spanish Game)",
    ("e2e4", "e7e5", "g1f3", "b8c6", "f1c4"): "Italian Game",
    ("e2e4", "e7e5", "g1f3", "b8c6", "d2d4"): "Scotch Game",
    ("e2e4", "e7e5", "g1f3", "g8f6"): "Petrov's Defense",
    ("e2e4", "e7e5", "f2f4"): "King's Gambit",
    ("d2d4", "d7d5", "c2c4"): "Queen's Gambit",
    ("d2d4", "d7d5", "c2c4", "e7e6"): "Queen's Gambit Declined",
    ("d2d4", "d7d5", "c2c4", "c7c6"): "Slav Defense",
    ("d2d4", "d7d5", "c2c4", "d5c4"): "Queen's Gambit Accepted",
    ("d2d4", "g8f6", "c2c4"): "Indian Game",
    ("d2d4", "g8f6", "c2c4", "g7g6"): "King's Indian Defense",
    ("d2d4", "g8f6", "c2c4", "e7e6"): "Nimzo/Queen's Indian",
    ("d2d4", "g8f6", "c2c4", "e7e6", "b1c3"): "Nimzo-Indian Defense",
    ("d2d4", "g8f6", "c2c4", "e7e6", "g1f3"): "Queen's Indian Defense",
    ("d2d4", "g8f6", "c2c4", "c7c5"): "Benoni Defense",
    ("d2d4", "g8f6", "g1f3", "g7g6"): "King's Indian Attack",
    ("c2c4", "e7e5"): "English Opening - Reversed Sicilian",
    ("c2c4", "g8f6"): "English Opening - Indian",
    ("c2c4", "c7c5"): "English Opening - Symmetrical",
}


def get_opening_from_moves(moves):
    best_match = "Unknown"
    for length in range(1, min(len(moves) + 1, 6)):
        key = tuple(moves[:length])
        if key in OPENING_BOOK:
            best_match = OPENING_BOOK[key]
    return best_match


def parse_games(pgn_text):
    games = []
    pgn_io = io.StringIO(pgn_text)
    while True:
        game = chess.pgn.read_game(pgn_io)
        if game is None:
            break
        games.append(game)
    return games


def get_opening_stats(games, username):
    from collections import defaultdict
    stats = defaultdict(lambda: {"wins": 0, "draws": 0, "losses": 0, "total": 0})

    for game in games:
        board = game.board()
        moves = []
        for i, move in enumerate(game.mainline_moves()):
            if i >= 5:
                break
            moves.append(move.uci())
            board.push(move)

        opening = game.headers.get("Opening", "")
        if not opening or opening == "?":
            opening = get_opening_from_moves(moves)

        result = game.headers.get("Result", "*")
        white = game.headers.get("White", "").lower()
        player_is_white = white == username.lower()

        if result == "1-0":
            outcome = "wins" if player_is_white else "losses"
        elif result == "0-1":
            outcome = "losses" if player_is_white else "wins"
        elif result == "1/2-1/2":
            outcome = "draws"
        else:
            continue

        stats[opening][outcome] += 1
        stats[opening]["total"] += 1

    result_list = []
    for opening, counts in stats.items():
        win_rate = round(counts["wins"] / counts["total"] * 100) if counts["total"] > 0 else 0
        result_list.append({
            "opening": opening,
            "wins": counts["wins"],
            "draws": counts["draws"],
            "losses": counts["losses"],
            "total": counts["total"],
            "win_rate": win_rate,
        })

    return sorted(result_list, key=lambda x: x["total"], reverse=True)


def build_player_summary(username, opening_stats, total_games):
    top = opening_stats[:5]
    weak = [o for o in opening_stats if o["total"] >= 3 and o["win_rate"] < 40][:3]

    lines = [
        f"Player: {username}",
        f"Total games analyzed: {total_games}",
        "",
        "Top openings played:",
    ]
    for o in top:
        lines.append(f"  - {o['opening']}: {o['total']} games, {o['win_rate']}% win rate")

    if weak:
        lines.append("")
        lines.append("Openings where this player struggles (win rate < 40%):")
        for o in weak:
            lines.append(f"  - {o['opening']}: {o['win_rate']}% win rate from {o['total']} games")

    return "\n".join(lines)