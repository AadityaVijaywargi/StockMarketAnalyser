class TickerNormalizer:
    """
    Generic Ticker Normalization Layer.
    Resolves variations of stock symbols, company names, and indices to official NSE suffixes.
    """
    MAPPING = {
        "RELIANCE": "RELIANCE.NS",
        "RELIANCE INDUSTRIES": "RELIANCE.NS",
        "TCS": "TCS.NS",
        "TATA CONSULTANCY SERVICES": "TCS.NS",
        "INFY": "INFY.NS",
        "INFOSYS": "INFY.NS",
        "SBIN": "SBIN.NS",
        "SBI": "SBIN.NS",
        "STATE BANK OF INDIA": "SBIN.NS",
        "HDFCBANK": "HDFCBANK.NS",
        "HDFC BANK": "HDFCBANK.NS",
        "HDFC": "HDFCBANK.NS",
        "ICICIBANK": "ICICIBANK.NS",
        "ICICI BANK": "ICICIBANK.NS",
        "ICICI": "ICICIBANK.NS",
        "BHARTIARTL": "BHARTIARTL.NS",
        "BHARTI AIRTEL": "BHARTIARTL.NS",
        "BHARTI": "BHARTIARTL.NS",
        "ADANI": "ADANIENT.NS",
        "ULTRATECH": "ULTRACEMCO.NS",
        "ULTRATECH CEMENT": "ULTRACEMCO.NS",
        "LT": "LT.NS",
        "LARSEN & TOUBRO": "LT.NS",
        "LARSEN": "LT.NS",
        "L&T": "LT.NS",
        "ITC": "ITC.NS",
        "TATAMOTORS": "TMCV.NS",
        "TATA MOTORS": "TMCV.NS",
        "TATASTEEL": "TATASTEEL.NS",
        "TATA STEEL": "TATASTEEL.NS",
        "TATAPOWER": "TATAPOWER.NS",
        "TATA POWER": "TATAPOWER.NS",
        "TITAN": "TITAN.NS",
        "TECHM": "TECHM.NS",
        "TECH MAHINDRA": "TECHM.NS",
        "RVNL": "RVNL.NS",
        "RBLBANK": "RBLBANK.NS",
        "RAIN": "RAIN.NS",
        "RAMCOCEM": "RAMCOCEM.NS",
        "RECLTD": "RECLTD.NS",
        "INOXWIND": "INOXWIND.NS",
        "INDIGO": "INDIGO.NS",
        "INDUSTOWER": "INDUSTOWER.NS",
        "WIPRO": "WIPRO.NS",
        "HINDUNILVR": "HINDUNILVR.NS",
        "AXISBANK": "AXISBANK.NS",
        "KOTAKBANK": "KOTAKBANK.NS",
        "ADANIENT": "ADANIENT.NS",
        "ADANIPORTS": "ADANIPORTS.NS",
        "ASIANPAINT": "ASIANPAINT.NS",
        "BAJFINANCE": "BAJFINANCE.NS",
        "BAJAJFINSV": "BAJAJFINSV.NS",
        "SUNPHARMA": "SUNPHARMA.NS",
        "MARUTI": "MARUTI.NS",
        "NTPC": "NTPC.NS",
        "ONGC": "ONGC.NS",
        "POWERGRID": "POWERGRID.NS",
        "JSWSTEEL": "JSWSTEEL.NS",
        "M&M": "M&M.NS",
        "COALINDIA": "COALINDIA.NS",
        "LTIM": "LTIM.NS",
        "ULTRACEMCO": "ULTRACEMCO.NS",
        "GRASIM": "GRASIM.NS",
        "JIOFIN": "JIOFIN.NS",
        "HAL": "HAL.NS",
        "HINDALCO": "HINDALCO.NS",
        "BPCL.NS": "BPCL.NS",
        "ADANIPOWER": "ADANIPOWER.NS",
        "IOC": "IOC.NS",
        "BEL": "BEL.NS",
        "IRFC": "IRFC.NS",
        "PNB": "PNB.NS",
        "DLF": "DLF.NS"
    }

    @classmethod
    def normalize(cls, query: str) -> str:
        clean = query.strip().upper()
        if clean.startswith("^"):
            return clean

        # Remove common suffixes before lookup
        if clean.endswith(".NS"):
            clean_base = clean[:-3]
        else:
            clean_base = clean

        # Check mapping
        if clean_base in cls.MAPPING:
            return cls.MAPPING[clean_base]
        if clean in cls.MAPPING:
            return cls.MAPPING[clean]

        # If not mapped, default format
        if not "." in clean:
            return f"{clean}.NS"
        return clean
