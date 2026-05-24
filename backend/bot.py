import random
import chess
import chess.pgn
import os
from collections import defaultdict

_stockfish = None

def _load_stockfish():
    global _stockfish
    try:
        from stockfish import Stockfish
        paths = ["/usr/games/stockfish","/usr/bin/stockfish","/usr/local/bin/stockfish","stockfish"]
        for path in paths:
            try:
                _stockfish = Stockfish(path=path, depth=15)
                print(f"Stockfish loaded from: {path}")
                return True
            except Exception:
                continue
        print("Stockfish binary not found, falling back to minimax")
        return False
    except ImportError:
        print("stockfish package not installed, falling back to minimax")
        return False

_load_stockfish()

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
    elos = []
    for game in games:
        white = game.headers.get("White", "").lower()
        if white == username.lower():
            elo = game.headers.get("WhiteElo", None)
        else:
            elo = game.headers.get("BlackElo", None)
        if elo and str(elo).isdigit():
            elos.append(int(elo))
    return int(sum(elos) / len(elos)) if elos else 1200

def _elo_to_stockfish_skill(elo):
    if elo < 600:    return 0,  0.30
    elif elo < 800:  return 2,  0.20
    elif elo < 1000: return 4,  0.12
    elif elo < 1200: return 6,  0.08
    elif elo < 1400: return 8,  0.05
    elif elo < 1600: return 11, 0.03
    elif elo < 1800: return 14, 0.015
    elif elo < 2000: return 16, 0.008
    elif elo < 2200: return 18, 0.003
    elif elo < 2500: return 19, 0.001
    else:            return 20, 0.0

PIECE_VALUES = {chess.PAWN:100,chess.KNIGHT:320,chess.BISHOP:330,chess.ROOK:500,chess.QUEEN:900,chess.KING:20000}

PST = {
    chess.PAWN:[0,0,0,0,0,0,0,0,5,10,10,-20,-20,10,10,5,5,-5,-10,0,0,-10,-5,5,0,0,0,20,20,0,0,0,5,5,10,25,25,10,5,5,10,10,20,30,30,20,10,10,50,50,50,50,50,50,50,50,0,0,0,0,0,0,0,0],
    chess.KNIGHT:[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,5,5,0,-20,-40,-30,5,10,15,15,10,5,-30,-30,0,15,20,20,15,0,-30,-30,5,15,20,20,15,5,-30,-30,0,10,15,15,10,0,-30,-40,-20,0,0,0,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
    chess.BISHOP:[-20,-10,-10,-10,-10,-10,-10,-20,-10,5,0,0,0,0,5,-10,-10,10,10,10,10,10,10,-10,-10,0,10,10,10,10,0,-10,-10,5,5,10,10,5,5,-10,-10,0,5,10,10,5,0,-10,-10,0,0,0,0,0,0,-10,-20,-10,-10,-10,-10,-10,-10,-20],
    chess.ROOK:[0,0,0,5,5,0,0,0,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,5,10,10,10,10,10,10,5,0,0,0,0,0,0,0,0],
    chess.QUEEN:[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,5,0,0,0,0,-10,-10,5,5,5,5,5,0,-10,0,0,5,5,5,5,0,-5,-5,0,5,5,5,5,0,-5,-10,0,5,5,5,5,0,-10,-10,0,0,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20],
    chess.KING:[20,30,10,0,0,10,30,20,20,20,0,0,0,0,20,20,-10,-20,-20,-20,-20,-20,-20,-10,-20,-30,-30,-40,-40,-30,-30,-20,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30],
}

def _pst(piece_type, square, is_white):
    table = PST.get(piece_type, [0]*64)
    return table[square if is_white else chess.square_mirror(square)]

def _evaluate_pst(board):
    if board.is_checkmate(): return -99999 if board.turn == chess.WHITE else 99999
    if board.is_stalemate() or board.is_insufficient_material(): return 0
    score = 0
    for sq, piece in board.piece_map().items():
        val = PIECE_VALUES.get(piece.piece_type, 0) + _pst(piece.piece_type, sq, piece.color == chess.WHITE)
        score += val if piece.color == chess.WHITE else -val
    return score

def _quiescence(board, alpha, beta, maximizing, depth=4):
    stand_pat = _evaluate_pst(board)
    if maximizing:
        if stand_pat >= beta: return beta
        alpha = max(alpha, stand_pat)
    else:
        if stand_pat <= alpha: return alpha
        beta = min(beta, stand_pat)
    if depth == 0: return stand_pat
    captures = [m for m in board.legal_moves if board.is_capture(m)]
    captures.sort(key=lambda m: PIECE_VALUES.get(board.piece_at(m.to_square).piece_type if board.piece_at(m.to_square) else chess.PAWN, 0), reverse=True)
    for move in captures:
        board.push(move)
        score = _quiescence(board, alpha, beta, not maximizing, depth-1)
        board.pop()
        if maximizing:
            alpha = max(alpha, score)
            if alpha >= beta: return beta
        else:
            beta = min(beta, score)
            if beta <= alpha: return alpha
    return alpha if maximizing else beta

def _move_score(board, move):
    score = 0
    if board.is_capture(move):
        victim = board.piece_at(move.to_square)
        attacker = board.piece_at(move.from_square)
        if victim and attacker:
            score += 10 * PIECE_VALUES.get(victim.piece_type, 0) - PIECE_VALUES.get(attacker.piece_type, 0)
    board.push(move)
    if board.is_check(): score += 50
    board.pop()
    return score

def _minimax(board, depth, alpha, beta, maximizing):
    if board.is_game_over(): return _evaluate_pst(board)
    if depth == 0: return _quiescence(board, alpha, beta, maximizing)
    moves = sorted(board.legal_moves, key=lambda m: _move_score(board, m), reverse=True)
    if maximizing:
        best = -999999
        for move in moves:
            board.push(move)
            best = max(best, _minimax(board, depth-1, alpha, beta, False))
            board.pop()
            alpha = max(alpha, best)
            if beta <= alpha: break
        return best
    else:
        best = 999999
        for move in moves:
            board.push(move)
            best = min(best, _minimax(board, depth-1, alpha, beta, True))
            board.pop()
            beta = min(beta, best)
            if beta <= alpha: break
        return best

def _elo_to_minimax_params(elo):
    if elo < 800:    return 3, 0.35
    elif elo < 1000: return 3, 0.20
    elif elo < 1200: return 3, 0.10
    elif elo < 1400: return 4, 0.06
    elif elo < 1600: return 4, 0.03
    elif elo < 1800: return 4, 0.015
    elif elo < 2000: return 5, 0.008
    elif elo < 2200: return 5, 0.003
    else:            return 6, 0.0

def get_bot_move(board, opening_book, stockfish_path=None, depth=None, elo=None):
    fen_key = " ".join(board.fen().split()[:4])
    target_elo = max(400, min(elo or 1200, 3200))
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
    legal_moves = list(board.legal_moves)
    if not legal_moves: return None
    if _stockfish is not None:
        try:
            skill_level, error_rate = _elo_to_stockfish_skill(target_elo)
            if random.random() < error_rate:
                return random.choice(legal_moves).uci()
            _stockfish.set_skill_level(skill_level)
            _stockfish.set_fen_position(board.fen())
            best = _stockfish.get_best_move()
            if best:
                move = chess.Move.from_uci(best)
                if move in board.legal_moves:
                    return best
        except Exception as e:
            print(f"Stockfish error: {e}, falling back to minimax")
    search_depth, error_rate = _elo_to_minimax_params(target_elo)
    if random.random() < error_rate:
        return random.choice(legal_moves).uci()
    maximizing = board.turn == chess.WHITE
    best_move = None
    best_score = -999999 if maximizing else 999999
    random.shuffle(legal_moves)
    for move in legal_moves:
        board.push(move)
        score = _minimax(board, search_depth-1, -999999, 999999, not maximizing)
        board.pop()
        if maximizing and score > best_score:
            best_score, best_move = score, move
        elif not maximizing and score < best_score:
            best_score, best_move = score, move
    return best_move.uci() if best_move else random.choice(legal_moves).uci()
