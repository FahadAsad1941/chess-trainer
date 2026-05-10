import random
import chess
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


def _evaluate(board):
    """Static evaluation in centipawns from White's perspective."""
    values = {
        chess.PAWN: 100,
        chess.KNIGHT: 320,
        chess.BISHOP: 330,
        chess.ROOK: 500,
        chess.QUEEN: 900,
        chess.KING: 20000,
    }
    if board.is_checkmate():
        return -99999 if board.turn == chess.WHITE else 99999
    if board.is_stalemate() or board.is_insufficient_material():
        return 0

    score = 0
    for sq, piece in board.piece_map().items():
        v = values.get(piece.piece_type, 0)
        score += v if piece.color == chess.WHITE else -v
    return score


def _minimax(board, depth, alpha, beta, maximizing):
    """Alpha-beta minimax search."""
    if depth == 0 or board.is_game_over():
        return _evaluate(board)

    # Captures first for better pruning
    moves = sorted(board.legal_moves, key=lambda m: board.is_capture(m), reverse=True)

    if maximizing:
        best = -999999
        for move in moves:
            board.push(move)
            best = max(best, _minimax(board, depth - 1, alpha, beta, False))
            board.pop()
            alpha = max(alpha, best)
            if beta <= alpha:
                break
        return best
    else:
        best = 999999
        for move in moves:
            board.push(move)
            best = min(best, _minimax(board, depth - 1, alpha, beta, True))
            board.pop()
            beta = min(beta, best)
            if beta <= alpha:
                break
        return best


def _elo_to_params(elo):
    """Map ELO to (search_depth, blunder_rate)."""
    if elo < 800:
        return 1, 0.60
    elif elo < 1000:
        return 1, 0.40
    elif elo < 1200:
        return 2, 0.25
    elif elo < 1400:
        return 2, 0.15
    elif elo < 1600:
        return 2, 0.08
    elif elo < 1800:
        return 3, 0.04
    elif elo < 2000:
        return 3, 0.02
    elif elo < 2200:
        return 3, 0.01
    elif elo < 2500:
        return 4, 0.005
    else:
        return 4, 0.0   # Hikaru-level: full strength, no blunders


def get_bot_move(board, opening_book, stockfish_path=None, depth=None, elo=None):
    fen_key = " ".join(board.fen().split()[:4])

    # 1. Use opening book (player's actual moves from their games)
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

    # 2. Minimax scaled to player's ELO (no Stockfish needed)
    target_elo = max(400, min(elo or 1200, 3200))
    search_depth, error_rate = _elo_to_params(target_elo)

    legal_moves = list(board.legal_moves)
    if not legal_moves:
        return None

    # Occasionally blunder to simulate human error at lower ELOs
    if random.random() < error_rate:
        return random.choice(legal_moves).uci()

    # Find best move via minimax
    maximizing = board.turn == chess.WHITE
    best_move = None
    best_score = -999999 if maximizing else 999999
    random.shuffle(legal_moves)  # break ties randomly (more human-like)

    for move in legal_moves:
        board.push(move)
        score = _minimax(board, search_depth - 1, -999999, 999999, not maximizing)
        board.pop()
        if maximizing and score > best_score:
            best_score, best_move = score, move
        elif not maximizing and score < best_score:
            best_score, best_move = score, move

    return best_move.uci() if best_move else random.choice(legal_moves).uci()