import json
import os
import re

SYMBOLS_JSON_PATH = os.path.join("frontend", "src", "components", "search", "symbols.json")

def normalize(text):
    return text.upper().replace('&', ' ').replace('-', ' ').replace(',', ' ').strip()

def search_service(query, catalog):
    raw_clean = query.strip().upper()
    if not raw_clean: return []

    norm_q = normalize(raw_clean)
    query_words = [w for w in norm_q.replace('.', ' ').split() if w not in ['NS', 'BO', 'NSE', 'BSE']]
    scored = []

    is_ticker_format = bool(re.match(r'^[A-Z0-9_\-\^]+(\.[A-Z]{2,4})?$', raw_clean))

    for item in catalog:
        ticker_full = item.get('ticker', '').upper()
        ticker_base = ticker_full.split('.')[0]
        name = normalize(item.get('name', ''))
        aliases = [normalize(a) for a in item.get('aliases', [])]

        score = 0
        if raw_clean == ticker_base or raw_clean == ticker_full:
            score = 1000
        elif norm_q in aliases:
            score = 950
        elif norm_q == name:
            score = 900
        elif ticker_base.startswith(norm_q) or ticker_full.startswith(norm_q):
            score = 850
        elif any(a.startswith(norm_q) for a in aliases) or name.startswith(norm_q):
            score = 800
        elif query_words:
            item_tokens = [ticker_base] + name.split() + [w for a in aliases for w in a.split()]
            matched = sum(1 for qw in query_words if any(t.startswith(qw) or qw.startswith(t) for t in item_tokens))
            if matched == len(query_words):
                score = 700 + matched * 10

        if score > 0:
            scored.append((score, item))

    if not any(s[0] >= 800 for s in scored) and is_ticker_format and '.' in raw_clean:
        dynamic_item = {
            'ticker': raw_clean,
            'name': raw_clean.split('.')[0],
            'exchange': 'NSE' if raw_clean.endswith('.NS') else 'BSE',
            'matchScore': 1000
        }
        scored.insert(0, (1000, dynamic_item))

    scored.sort(key=lambda x: x[0], reverse=True)
    return scored

def main():
    with open(SYMBOLS_JSON_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    test_cases = [
        "DEVYANI.NS",
        "DEVYANI",
        "TCS",
        "LT",
        "RELIANCE",
        "INFY",
        "XYZ999"
    ]

    print("=== PHASE 24.1 SEARCH VALIDATION TEST ===")
    for q in test_cases:
        res = search_service(q, catalog)
        if res:
            top_score, top_item = res[0]
            auto_nav = "YES (AUTO-NAVIGATE)" if top_score >= 750 else "NO (SHOW SUGGESTIONS)"
            print(f"Query: {q:<12} | Top Match: {top_item['ticker']:<15} | Score: {top_score:<4} | Action: {auto_nav}")
        else:
            print(f"Query: {q:<12} | Top Match: NONE            | Score: 0    | Action: NO (SHOW SUGGESTIONS)")

if __name__ == "__main__":
    main()
