import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from analysis.downloader import YahooDownloader
from analysis.normalizer import TickerNormalizer

downloader = YahooDownloader()

print("Testing TickerNormalizer with ^NSEI ...")
norm = TickerNormalizer.normalize("^NSEI")
print(f"Normalized '^NSEI' -> '{norm}'")

df = downloader.download_ticker_data("^NSEI", interval="1d")
if df is not None and not df.empty:
    print(f"SUCCESS! Downloaded {len(df)} rows for ^NSEI")
else:
    print("FAILED to download ^NSEI")
