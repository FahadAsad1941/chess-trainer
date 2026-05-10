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


def get_bot_move(board, opening_book, stockfish_path, depth=10):
    fen_key = " ".join(board.fen().split()[:4])

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

    try:
        engine = chess.engine.SimpleEngine.popen_uci(stockfish_path)
        result = engine.play(board, chess.engine.Limit(depth=depth))
        engine.quit()
        return result.move.uci()
    except Exception:
        legal = list(board.legal_moves)
        return random.choice(legal).uci() if legal else None