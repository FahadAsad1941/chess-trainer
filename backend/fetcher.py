"""
fetcher.py
Fetches PGN games from the Chess.com public API.
No API key needed.
"""

import requests


def fetch_games_pgn(username: str, max_games: int = 50) -> str:
    """
    Returns all recent games as a single PGN string.
    Chess.com organizes games by month, so we fetch the most recent months
    until we have enough games.
    """
    headers = {"User-Agent": "chess-trainer-project contact@example.com"}

    # Step 1: get list of all available monthly archive URLs
    archives_url = f"https://api.chess.com/pub/player/{username}/games/archives"
    resp = requests.get(archives_url, headers=headers, timeout=15)

    if resp.status_code == 404:
        raise ValueError(f"Player '{username}' not found on Chess.com")
    resp.raise_for_status()

    archive_urls = resp.json().get("archives", [])
    if not archive_urls:
        raise ValueError(f"No games found for '{username}' on Chess.com")

    # Step 2: fetch from most recent months first, stop when we have enough
    all_pgn_parts = []
    games_collected = 0

    for url in reversed(archive_urls):  # most recent first
        if games_collected >= max_games:
            break

        month_resp = requests.get(url + "/pgn", headers=headers, timeout=15)
        if month_resp.status_code != 200:
            continue

        pgn_text = month_resp.text.strip()
        if not pgn_text:
            continue

        # Count games in this chunk (each game starts with [Event)
        chunk_count = pgn_text.count("[Event ")
        all_pgn_parts.append(pgn_text)
        games_collected += chunk_count

    if not all_pgn_parts:
        raise ValueError(f"Could not retrieve games for '{username}'")

    return "\n\n".join(all_pgn_parts)
