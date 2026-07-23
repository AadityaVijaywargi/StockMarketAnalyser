import symbolsData from './symbols.json';

export interface SearchStock {
  ticker: string;
  name: string;
  exchange: string;
}

export class SearchService {
  private static symbols: SearchStock[] = symbolsData as SearchStock[];

  /**
   * Searches the symbol list by company name or stock ticker.
   * Supports partial matches, case insensitivity, and starts-with prefix matching boosts.
   */
  public static search(query: string): SearchStock[] {
    const cleanQuery = query.trim().toUpperCase();
    if (!cleanQuery) return [];

    // Filter elements
    const results = this.symbols.filter(item => {
      const tickerBase = item.ticker.split('.')[0].toUpperCase();
      const tickerFull = item.ticker.toUpperCase();
      const name = item.name.toUpperCase();

      return (
        tickerBase.includes(cleanQuery) ||
        tickerFull.includes(cleanQuery) ||
        name.includes(cleanQuery)
      );
    });

    // Rank matching results: items starting with query are sorted first
    return results.sort((a, b) => {
      const aBase = a.ticker.split('.')[0];
      const bBase = b.ticker.split('.')[0];
      
      const aStartsSymbol = aBase.startsWith(cleanQuery);
      const bStartsSymbol = bBase.startsWith(cleanQuery);

      if (aStartsSymbol && !bStartsSymbol) return -1;
      if (!aStartsSymbol && bStartsSymbol) return 1;

      const aStartsName = a.name.toUpperCase().startsWith(cleanQuery);
      const bStartsName = b.name.toUpperCase().startsWith(cleanQuery);

      if (aStartsName && !bStartsName) return -1;
      if (!aStartsName && bStartsName) return 1;

      return a.ticker.localeCompare(b.ticker);
    });
  }

  /**
   * Retrieves stock symbol details by exact or base ticker matching.
   */
  public static getStockDetails(ticker: string): SearchStock | undefined {
    const clean = ticker.trim().toUpperCase();
    return this.symbols.find(item => {
      const base = item.ticker.split('.')[0].toUpperCase();
      return item.ticker.toUpperCase() === clean || base === clean;
    });
  }
}
