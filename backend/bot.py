import random
import chess
import chess.pgn
import chess.engine
from collections import defaultdict


def build_opening_book(games, username, max_depth=15):
    book = defaultdict(lambda: defaultdict(int))

    for game in games:
        board = game.board()
        white = game.headers.get("White", "").lower()
        player_is_white = white == username.lower()

        for i, move in enumerate(game.mainline_moves()):
            if i >= max_depth:
                break
            is_players_turn = (board.turn == chess.WHITE and player_is_white) or \
                               (board.turn == chess.BLACK and not player_is_white)
            if is_players_turn:
                fen = " ".join(board.fen().split()[:4])
                book[fen][move.uci()] += 1
            board.push(move)

    return {fen: dict(moves) for fen, moves in book.items()}


def estimate_elo(games, username):
    """Estimate player ELO from game headers."""
    elos = []
    for game in games:
        white = game.headers.get("White", "").lower()
        if white == username.lower():
            elo = game.headers.get("WhiteElo", None)
        else:
            elo = game.headers.get("BlackElo", None)
        if elo and str(elo).isdigit():
            elos.append(int(elo))
    if elos:
        return int(sum(elos) / len(elos))
    return 1200


def get_bot_move(board, opening_book, stockfish_path, depth=None, elo=None):
    fen_key = " ".join(board.fen().split()[:4])

    # Use opening book first
    if fen_key in opening_book:
        moves = opening_book[fen_key]
        total = sum(moves.values())
        roll = random.randint(1, total)
        cumulative = 0
        for uci_move, count in moves.items():
            cumulative += count
            if roll <= cumulative:
                move = chess.Move.from_uci(uci_move)
                if move in board.legal_moves:
                    return uci_move

    # Use Stockfish UCI_Elo for accurate strength matching
    target_elo = max(500, min(elo or 1200, 3000))

    try:
        engine = chess.engine.SimpleEngine.popen_uci(stockfish_path)
        engine.configure({
            "UCI_LimitStrength": True,
            "UCI_Elo": target_elo
        })
        result = engine.play(board, chess.engine.Limit(time=0.5))
        engine.quit()
        return result.move.uci()
    except Exception as e:
        print(f"Stockfish error: {e}")
        # Fallback to random legal move
        legal = list(board.legal_moves)
        return random.choice(legal).uci() if legal else None