import React, { useState, useEffect } from 'react';
import { Newspaper, Calendar, ShieldCheck, TrendingUp, TrendingDown, Minus, ExternalLink, ChevronDown, ChevronUp, Tag, Search, Sparkles, CheckCircle2 } from 'lucide-react';
import { IntelligencePack, NewsArticle, KeyEvent } from '../types';
import { apiService } from '../services/api';

interface MarketIntelligenceSectionProps {
  intelligencePack?: IntelligencePack;
  ticker: string;
}

// Utility: Clean HTML tags and decode HTML entities completely
const cleanHtmlText = (rawText: string): string => {
  if (!rawText) return "";
  let text = rawText
    .replace(/<[^>]*>?/gm, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
};

// Utility: Calculate Relative Time (e.g. "12 minutes ago", "2 hours ago", "Yesterday")
const getRelativeTime = (publishedAt: string): string => {
  if (!publishedAt) return "Recently";
  try {
    const pubDate = new Date(publishedAt);
    if (isNaN(pubDate.getTime())) {
      // Fallback for formatted dates like "Fri, 25 Jul 2026 10:30:00 GMT"
      const parsed = Date.parse(publishedAt);
      if (isNaN(parsed)) return publishedAt.split('T')[0] || "Recently";
    }

    const now = new Date();
    const diffMs = now.getTime() - (isNaN(pubDate.getTime()) ? Date.parse(publishedAt) : pubDate.getTime());
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 5) return "Just now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours === 1) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return publishedAt.split('T')[0] || "Recently";
  } catch (e) {
    return publishedAt.split('T')[0] || "Recently";
  }
};

export const MarketIntelligenceSection: React.FC<MarketIntelligenceSectionProps> = ({ intelligencePack: propPack, ticker }) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'company' | 'sector' | 'macro' | 'events'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedArticles, setExpandedArticles] = useState<Record<string, boolean>>({});
  const [fetchedPack, setFetchedPack] = useState<IntelligencePack | undefined>(propPack);
  const [isFetching, setIsFetching] = useState<boolean>(!propPack);
  const [fetchFailed, setFetchFailed] = useState<boolean>(false);

  useEffect(() => {
    if (propPack) {
      setFetchedPack(propPack);
      setIsFetching(false);
      return;
    }

    let isMounted = true;
    setIsFetching(true);
    setFetchFailed(false);

    const timeoutTimer = setTimeout(() => {
      if (isMounted && !fetchedPack) {
        setIsFetching(false);
        setFetchFailed(true);
      }
    }, 4500);

    apiService.getIntelligenceNews(ticker)
      .then(pack => {
        if (isMounted) {
          setFetchedPack(pack);
          setIsFetching(false);
        }
      })
      .catch(err => {
        console.warn("Client Market Intelligence fetch failed:", err);
        if (isMounted) {
          setFetchFailed(true);
          setIsFetching(false);
        }
      })
      .finally(() => {
        clearTimeout(timeoutTimer);
      });

    return () => {
      isMounted = false;
      clearTimeout(timeoutTimer);
    };
  }, [propPack, ticker]);

  const intelligencePack = propPack || fetchedPack;

  if (isFetching && !intelligencePack) {
    return (
      <div className="bg-surface border border-borderDark/40 p-8 rounded-2xl flex flex-col items-center justify-center text-center gap-3">
        <Newspaper className="w-8 h-8 text-brand animate-pulse" />
        <h3 className="text-sm font-mono text-white font-bold">Compiling Verified Market News & Intelligence...</h3>
        <p className="text-xs text-textMuted max-w-md">Gathering institutional feeds, corporate actions, and sentiment data for {ticker}.</p>
      </div>
    );
  }

  if (fetchFailed && !intelligencePack) {
    return (
      <div className="bg-surface border border-borderDark/40 p-6 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
        <Newspaper className="w-6 h-6 text-textMuted" />
        <h3 className="text-sm font-mono text-white font-bold">Market Intelligence Feed Offline</h3>
        <p className="text-xs text-textMuted">Unable to compile live news stream for {ticker} at this moment. Technical quantitative analysis remains operational.</p>
      </div>
    );
  }

  const { company_news = [], sector_news = [], macro_news = [], key_events = [], overall_sentiment } = intelligencePack || {};
  const allArticles: NewsArticle[] = [...(company_news || []), ...(sector_news || []), ...(macro_news || [])];

  // Category and Search Query Filter
  const filteredArticles = allArticles.filter(art => {
    // 1. Category Filter
    if (activeCategory === 'company' && art.article_type !== 'company') return false;
    if (activeCategory === 'sector' && art.article_type !== 'sector') return false;
    if (activeCategory === 'macro' && art.article_type !== 'macro') return false;

    // 2. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const head = cleanHtmlText(art.headline).toLowerCase();
      const sum = cleanHtmlText(art.summary).toLowerCase();
      const pub = (art.publisher || '').toLowerCase();
      const topic = (art.topic || '').toLowerCase();
      const ents = (art.entities || []).join(' ').toLowerCase();

      return head.includes(q) || sum.includes(q) || pub.includes(q) || topic.includes(q) || ents.includes(q);
    }

    return true;
  });

  const toggleArticle = (id: string) => {
    setExpandedArticles(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getSentimentBadge = (sentiment: 'Bullish' | 'Neutral' | 'Bearish') => {
    switch (sentiment) {
      case 'Bullish':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-bullish/10 border border-bullish/30 text-bullish">
            <TrendingUp className="w-3 h-3" /> BULLISH
          </span>
        );
      case 'Bearish':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-bearish/10 border border-bearish/30 text-bearish">
            <TrendingDown className="w-3 h-3" /> BEARISH
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
            <Minus className="w-3 h-3" /> NEUTRAL
          </span>
        );
    }
  };

  const getRelevancePill = (score: number) => {
    const rounded = Math.round(score);
    if (rounded >= 80) {
      return (
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-brand/15 text-brand border border-brand/30">
          High {rounded}%
        </span>
      );
    }
    if (rounded >= 50) {
      return (
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
          Medium {rounded}%
        </span>
      );
    }
    return (
      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
        Low {rounded}%
      </span>
    );
  };

  return (
    <div className="bg-surface border border-borderDark/60 rounded-2xl p-6 flex flex-col gap-6 font-sans">
      
      {/* Header & Dominant Sentiment Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-borderDark/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">Market Intelligence & Verified News Stream</h3>
            <p className="text-xs text-textMuted mt-0.5">Real-time institutional media feeds, corporate disclosures, and sentiment breakdown</p>
          </div>
        </div>

        {/* Sentiment Overview Bar */}
        {overall_sentiment && (
          <div className="bg-background border border-borderDark/40 p-3.5 rounded-xl flex flex-col sm:flex-row items-center gap-4 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-textMuted uppercase">DOMINANT SENTIMENT:</span>
              {getSentimentBadge(overall_sentiment.primary_sentiment)}
            </div>

            <div className="w-full sm:w-48 bg-borderDark/60 h-2 rounded-full overflow-hidden flex">
              <div className="bg-bullish h-full" style={{ width: `${overall_sentiment.bullish_pct}%` }} title={`Bullish: ${overall_sentiment.bullish_pct}%`} />
              <div className="bg-slate-500 h-full" style={{ width: `${overall_sentiment.neutral_pct}%` }} title={`Neutral: ${overall_sentiment.neutral_pct}%`} />
              <div className="bg-bearish h-full" style={{ width: `${overall_sentiment.bearish_pct}%` }} title={`Bearish: ${overall_sentiment.bearish_pct}%`} />
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-bullish font-bold">{overall_sentiment.bullish_pct}% Bull</span>
              <span className="text-textMuted">•</span>
              <span className="text-bearish font-bold">{overall_sentiment.bearish_pct}% Bear</span>
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs & Live Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-borderDark/40 pb-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 font-mono text-xs">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3.5 py-1.5 rounded-lg border transition-all ${activeCategory === 'all' ? 'bg-brand/15 border-brand text-brand font-bold' : 'bg-background border-borderDark/40 text-textMuted hover:text-white'}`}
          >
            All News ({allArticles.length})
          </button>
          <button
            onClick={() => setActiveCategory('company')}
            className={`px-3.5 py-1.5 rounded-lg border transition-all ${activeCategory === 'company' ? 'bg-brand/15 border-brand text-brand font-bold' : 'bg-background border-borderDark/40 text-textMuted hover:text-white'}`}
          >
            Company ({company_news.length})
          </button>
          <button
            onClick={() => setActiveCategory('sector')}
            className={`px-3.5 py-1.5 rounded-lg border transition-all ${activeCategory === 'sector' ? 'bg-brand/15 border-brand text-brand font-bold' : 'bg-background border-borderDark/40 text-textMuted hover:text-white'}`}
          >
            Sector ({sector_news.length})
          </button>
          <button
            onClick={() => setActiveCategory('macro')}
            className={`px-3.5 py-1.5 rounded-lg border transition-all ${activeCategory === 'macro' ? 'bg-brand/15 border-brand text-brand font-bold' : 'bg-background border-borderDark/40 text-textMuted hover:text-white'}`}
          >
            Macro ({macro_news.length})
          </button>
          <button
            onClick={() => setActiveCategory('events')}
            className={`px-3.5 py-1.5 rounded-lg border transition-all ${activeCategory === 'events' ? 'bg-brand/15 border-brand text-brand font-bold' : 'bg-background border-borderDark/40 text-textMuted hover:text-white'}`}
          >
            Events ({key_events.length})
          </button>
        </div>

        {/* Search Input Filter */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-textMuted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company, topic, publisher..."
            className="w-full bg-background border border-borderDark/60 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-textMuted focus:outline-none focus:border-brand transition-all font-mono"
          />
        </div>
      </div>

      {/* Key Corporate Events (When 'all' or 'events' selected) */}
      {(activeCategory === 'all' || activeCategory === 'events') && key_events.length > 0 && !searchQuery && (
        <div className="bg-background border border-borderDark/40 p-4 rounded-xl flex flex-col gap-3">
          <h4 className="text-xs font-bold font-mono text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-borderDark/40 pb-2">
            <Calendar className="w-4 h-4 text-brand" />
            <span>Key Corporate Actions & Earnings Calendar</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {key_events.map((evt: KeyEvent) => (
              <div key={evt.id} className="bg-surface/80 border border-borderDark/40 p-3.5 rounded-lg flex flex-col gap-2">
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span className="text-brand font-bold uppercase tracking-wide">
                    {evt.event_type}
                  </span>
                  <div className="flex items-center gap-2">
                    {getSentimentBadge(evt.sentiment)}
                  </div>
                </div>
                <h5 className="text-xs font-bold text-white">{cleanHtmlText(evt.title)}</h5>
                <p className="text-[11px] text-textMuted leading-relaxed">{cleanHtmlText(evt.description)}</p>
                <span className="text-[9px] font-mono text-textMuted block text-right mt-1">Date: {evt.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Articles Feed */}
      {activeCategory !== 'events' && (
        <div className="flex flex-col gap-4">
          {filteredArticles.length === 0 ? (
            <div className="text-center p-8 bg-background rounded-xl border border-borderDark/40 text-textMuted text-xs font-mono">
              No news articles match your selected filter or search query.
            </div>
          ) : (
            filteredArticles.map(article => {
              const isExpanded = expandedArticles[article.id];
              const cleanHeadline = cleanHtmlText(article.headline);
              const cleanSummary = cleanHtmlText(article.summary);
              const relativeTime = getRelativeTime(article.published_at);
              const isVerified = article.is_verified_source || article.source_credibility === 'High' || article.source_credibility === 'Medium-High';
              const articleUrl = article.url || '#';

              // Extract key points (3-5 points)
              const points = article.key_points && article.key_points.length > 0 
                ? article.key_points 
                : [
                    `Event: ${cleanHeadline}`,
                    `Company Context: ${ticker} market positioning & sentiment`,
                    `Impact Assessment: ${cleanSummary.slice(0, 90)}...`
                  ];

              return (
                <div 
                  key={article.id} 
                  className="bg-background border border-borderDark/50 hover:border-brand/40 p-5 rounded-xl flex flex-col gap-3.5 transition-all shadow-sm"
                >
                  {/* News Card Header Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borderDark/40 pb-3">
                    <div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px]">
                      {/* Publisher Name */}
                      <span className="text-white font-bold text-xs">{article.publisher || 'Financial Media'}</span>

                      {/* Verified Source Badge */}
                      {isVerified && (
                        <span className="flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" title="Verified Tier-1 Financial Media Source">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" /> Verified Source
                        </span>
                      )}

                      <span className="text-borderDark">•</span>

                      {/* Relative Time */}
                      <span className="text-textMuted">{relativeTime}</span>

                      {/* Topic Category */}
                      <span className="bg-surface px-2 py-0.5 rounded text-[9px] font-bold text-brand border border-brand/20 uppercase">
                        {article.topic || 'General'}
                      </span>
                    </div>

                    {/* Relevance & Sentiment Badges */}
                    <div className="flex items-center gap-2.5 font-mono">
                      {getRelevancePill(article.relevance_score)}
                      {getSentimentBadge(article.sentiment)}
                    </div>
                  </div>

                  {/* Headline */}
                  <h4 
                    onClick={() => toggleArticle(article.id)}
                    className="text-base md:text-lg font-bold text-slate-100 hover:text-brand transition-colors cursor-pointer leading-snug font-sans"
                  >
                    {cleanHeadline}
                  </h4>

                  {/* Concise Summary (60-120 words / 2-4 sentences preview) */}
                  {cleanSummary && (
                    <p className="text-xs md:text-sm text-textMuted leading-relaxed font-sans">
                      {cleanSummary}
                    </p>
                  )}

                  {/* Expanded Section (Key Points + Related Tickers) */}
                  {isExpanded && (
                    <div className="mt-1 p-4 rounded-xl bg-surface/60 border border-borderDark/60 flex flex-col gap-3 font-sans text-xs animate-fadeIn">
                      <div className="font-bold text-slate-200 uppercase tracking-wider text-[11px] font-mono flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-brand" />
                        Key Insights & Takeaways
                      </div>
                      <ul className="flex flex-col gap-1.5 text-slate-300">
                        {points.map((pt, pIdx) => (
                          <li key={pIdx} className="flex items-start gap-2">
                            <span className="text-brand font-bold text-sm leading-none mt-0.5">•</span>
                            <span>{cleanHtmlText(pt)}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Ticker Chips */}
                      {article.entities && article.entities.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-borderDark/40 font-mono text-[10px]">
                          <span className="text-textMuted font-medium">Related Tickers:</span>
                          {article.entities.map((ent, idx) => (
                            <span key={idx} className="bg-background border border-borderDark px-2 py-0.5 rounded text-brand font-bold">
                              ${ent}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="flex items-center justify-between pt-2 border-t border-borderDark/30">
                    {/* Expand / Collapse Toggle Button */}
                    <button
                      onClick={() => toggleArticle(article.id)}
                      className="text-xs font-mono text-textMuted hover:text-white transition-colors flex items-center gap-1"
                    >
                      {isExpanded ? (
                        <>Show Less <ChevronUp className="w-3.5 h-3.5 text-brand" /></>
                      ) : (
                        <>Read Key Points <ChevronDown className="w-3.5 h-3.5 text-brand" /></>
                      )}
                    </button>

                    {/* Primary Action Button: Read Full Article */}
                    {articleUrl && articleUrl !== '#' && (
                      <a
                        href={articleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-brand hover:bg-brand/80 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-md"
                        title={`Read original article on ${article.publisher || 'publisher website'}`}
                      >
                        <span>Read Full Article</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
};
