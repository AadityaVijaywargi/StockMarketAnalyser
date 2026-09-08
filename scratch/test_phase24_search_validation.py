import json
import os

SYMBOLS_JSON_PATH = os.path.join("frontend", "src", "components", "search", "symbols.json")

def normalize(text):
    return text.upper().replace("&", " ").replace(".", " ").replace("-", " ").replace(",", " ").strip()

def levenshtein_distance(a, b):
    m, n = len(a), len(b)
    if m == 0: return n
    if n == 0: return m
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1): dp[i][0] = i
    for j in range(n + 1): dp[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    return dp[m][n]

def similarity(a, b):
    na, nb = normalize(a), normalize(b)
    if na == nb: return 1.0
    dist = levenshtein_distance(na, nb)
    maxlen = max(len(na), len(nb))
    if maxlen == 0: return 1.0
    return 1.0 - dist / maxlen

def search_symbols(query, catalog):
    raw_clean = query.strip()
    if not raw_clean: return []
    norm_q = normalize(raw_clean)
    query_words = norm_q.split()

    scored = []
    for item in catalog:
        ticker = item.get("ticker", "")
        ticker_base = normalize(ticker.split(".")[0])
        name = normalize(item.get("name", ""))
        aliases = [normalize(a) for a in item.get("aliases", [])]

        score = 0
        if norm_q == ticker_base or norm_q == normalize(ticker):
            score = 1000
        elif norm_q in aliases:
            score = 950
        elif norm_q == name:
            score = 900
        elif ticker_base.startswith(norm_q) or normalize(ticker).startswith(norm_q):
            score = 850
        elif any(a.startswith(norm_q) for a in aliases) or name.startswith(norm_q):
            score = 800
        else:
            item_tokens = [ticker_base] + name.split() + [w for a in aliases for w in a.split()]
            matched = sum(1 for qw in query_words if any(t.startswith(qw) or qw.startswith(t) for t in item_tokens))
            if matched == len(query_words) and len(query_words) > 0:
                score = 700 + matched * 10
            elif matched > 0:
                score = 550 + matched * 10

        if score == 0:
            if norm_q in name or norm_q in ticker_base or any(norm_q in a for a in aliases):
                score = 500

        if score == 0 and len(norm_q) >= 3:
            max_sim = similarity(norm_q, ticker_base)
            for a in aliases: max_sim = max(max_sim, similarity(norm_q, a))
            for w in name.split():
                if len(w) >= 3: max_sim = max(max_sim, similarity(norm_q, w))
            if max_sim >= 0.60:
                score = 300 + int(max_sim * 100)

        if score > 0:
            scored.append((score, item))

    scored.sort(key=lambda x: (x[0], x[1]["ticker"]), reverse=True)
    return scored

def main():
    with open(SYMBOLS_JSON_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    test_queries = [
        "TCS", "Tata", "Reliance", "HDFC", "HDFC Bank", "Infosys", "INFY",
        "Nifty", "Bank Nifty", "ICICI", "Axis", "Kotak", "Adani", "Adani Power",
        "Power Grid", "NTPC", "HAL", "BEL", "L&T", "LT", "Tata Motors", "M&M",
        "Mahindra", "Sun Pharma", "Asian Paints", "Relince", "Infosis", "HDFCBK",
        "Tata Cons", "Tata Serv"
    ]

    print(f"{'QUERY':<15} | {'COUNT':<5} | {'TOP RESULT TICKER':<15} | {'TOP RESULT NAME'}")
    print("-" * 75)
    for q in test_queries:
        res = search_symbols(q, catalog)
        count = len(res)
        if count > 0:
            top_score, top_item = res[0]
            print(f"{q:<15} | {count:<5} | {top_item['ticker']:<15} | {top_item['name']} (Score: {top_score})")
        else:
            print(f"{q:<15} | {0:<5} | {'NO MATCH':<15} | None")

if __name__ == "__main__":
    main()
