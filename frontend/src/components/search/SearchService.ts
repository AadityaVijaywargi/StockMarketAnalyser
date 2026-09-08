import symbolsData from './symbols.json';

export interface SearchStock {
  ticker: string;
  name: string;
  exchange: string;
  sector?: string;
  industry?: string;
  aliases?: string[];
  matchScore?: number;
  isFuzzySuggestion?: boolean;
}

// Helper: Normalize text by stripping punctuation and extra spaces
function normalize(text: string): string {
  return text
    .toUpperCase()
    .replace(/[&\.\-,\'"\\\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper: Compute Levenshtein Distance for typo tolerance
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // Deletion
        dp[i][j - 1] + 1,       // Insertion
        dp[i - 1][j - 1] + cost  // Substitution
      );
    }
  }
  return dp[m][n];
}

// Helper: Compute similarity ratio (0.0 to 1.0)
function computeSimilarity(a: string, b: string): number {
  const normA = normalize(a);
  const normB = normalize(b);
  if (normA === normB) return 1.0;
  
  const dist = levenshteinDistance(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1.0;
  return 1.0 - dist / maxLen;
}

export class SearchService {
  private static symbols: SearchStock[] = symbolsData as SearchStock[];

  /**
   * Multi-tiered ranking search engine with fuzzy matching & typo tolerance.
   */
  public static search(query: string): SearchStock[] {
    const rawClean = query.trim().toUpperCase();
    if (!rawClean) return [];

    const normQuery = normalize(rawClean);
    // Exclude common exchange suffix tokens when checking multi-word tokens
    const queryWords = normQuery.split(' ').filter(w => w && !['NS', 'BO', 'NSE', 'BSE'].includes(w));
    const scoredResults: SearchStock[] = [];

    // Check if query is formatted like a valid exchange ticker (e.g., DEVYANI.NS, ZOMATO.NS)
    const isTickerFormat = /^[A-Z0-9_\-\^]+(\.[A-Z]{2,4})?$/.test(rawClean);

    for (const item of this.symbols) {
      const tickerFull = item.ticker.toUpperCase();
      const tickerBase = tickerFull.split('.')[0];
      const companyName = normalize(item.name);
      const aliases = (item.aliases || []).map(normalize);

      let score = 0;
      let matchedWordCount = 0;

      // 1. Exact Ticker Match (1000 pts)
      if (rawClean === tickerBase || rawClean === tickerFull) {
        score = 1000;
      }
      // 2. Exact Alias Match (950 pts)
      else if (aliases.includes(normQuery)) {
        score = 950;
      }
      // 3. Exact Company Name Match (900 pts)
      else if (normQuery === companyName) {
        score = 900;
      }
      // 4. Starts-With Ticker Match (850 pts)
      else if (tickerBase.startsWith(normQuery) || tickerFull.startsWith(normQuery)) {
        score = 850;
      }
      // 5. Starts-With Alias or Company Name Match (800 pts)
      else if (aliases.some(a => a.startsWith(normQuery)) || companyName.startsWith(normQuery)) {
        score = 800;
      }
      // 6. Word Boundary / Multi-Word Prefix Matching (700 pts)
      else if (queryWords.length > 0) {
        const itemTokens = [
          tickerBase,
          ...companyName.split(' '),
          ...aliases.flatMap(a => a.split(' '))
        ].filter(Boolean);

        for (const qw of queryWords) {
          if (itemTokens.some(token => token.startsWith(qw) || qw.startsWith(token))) {
            matchedWordCount++;
          }
        }

        if (matchedWordCount === queryWords.length && queryWords.length > 0) {
          score = 700 + matchedWordCount * 10;
        }
      }

      // 7. Substring Inclusion Match (500 pts)
      if (score === 0 && normQuery.length >= 3) {
        if (
          companyName.includes(normQuery) ||
          tickerBase.includes(normQuery) ||
          aliases.some(a => a.includes(normQuery))
        ) {
          score = 500;
        }
      }

      // 8. Fuzzy / Typo Match (Levenshtein Distance)
      if (score === 0 && normQuery.length >= 3) {
        // Compare query with ticker, aliases, and company name words
        let maxSim = computeSimilarity(normQuery, tickerBase);
        
        for (const alias of aliases) {
          maxSim = Math.max(maxSim, computeSimilarity(normQuery, alias));
        }

        for (const word of companyName.split(' ')) {
          if (word.length >= 3) {
            maxSim = Math.max(maxSim, computeSimilarity(normQuery, word));
          }
        }

        if (maxSim >= 0.60) {
          score = 300 + Math.round(maxSim * 100);
        }
      }

      if (score > 0) {
        scoredResults.push({
          ...item,
          matchScore: score
        });
      }
    }

    // If no catalog symbol matched with high confidence (>= 800) and query looks like a valid exchange ticker (e.g. DEVYANI or DEVYANI.NS or ^NSEI)
    if (!scoredResults.some(r => (r.matchScore || 0) >= 800) && isTickerFormat) {
      const formattedTicker = rawClean.startsWith('^') || rawClean.includes('.') ? rawClean : `${rawClean}.NS`;
      scoredResults.unshift({
        ticker: formattedTicker,
        name: rawClean.split('.')[0],
        exchange: formattedTicker.endsWith('.BO') ? 'BSE' : 'NSE',
        matchScore: 1000
      });
    }

    // Sort descending by score, tie-breaker by ticker alphabetical
    scoredResults.sort((a, b) => {
      const scoreDiff = (b.matchScore || 0) - (a.matchScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return a.ticker.localeCompare(b.ticker);
    });

    // Check if top match is a fuzzy suggestion ("Did you mean...?")
    if (scoredResults.length > 0 && (scoredResults[0].matchScore || 0) < 500) {
      return scoredResults.map(r => ({ ...r, isFuzzySuggestion: true }));
    }

    return scoredResults;
  }

  /**
   * Retrieves stock details by exact or base ticker matching.
   */
  public static getStockDetails(ticker: string): SearchStock | undefined {
    const clean = normalize(ticker);
    return this.symbols.find(item => {
      const base = normalize(item.ticker.split('.')[0]);
      return normalize(item.ticker) === clean || base === clean;
    });
  }

  /**
   * Retrieves popular/trending stocks catalog.
   */
  public static getPopularStocks(): SearchStock[] {
    return [
      { ticker: "RELIANCE.NS", name: "Reliance Industries Limited", exchange: "NSE", sector: "Energy" },
      { ticker: "TCS.NS", name: "Tata Consultancy Services Limited", exchange: "NSE", sector: "IT Services" },
      { ticker: "INFY.NS", name: "Infosys Limited", exchange: "NSE", sector: "IT Services" },
      { ticker: "HDFCBANK.NS", name: "HDFC Bank Limited", exchange: "NSE", sector: "Banking" },
      { ticker: "ICICIBANK.NS", name: "ICICI Bank Limited", exchange: "NSE", sector: "Banking" },
      { ticker: "SBIN.NS", name: "State Bank of India", exchange: "NSE", sector: "Banking" },
      { ticker: "BHARTIARTL.NS", name: "Bharti Airtel Limited", exchange: "NSE", sector: "Telecom" },
      { ticker: "LT.NS", name: "Larsen & Toubro Limited", exchange: "NSE", sector: "Capital Goods" }
    ];
  }
}
