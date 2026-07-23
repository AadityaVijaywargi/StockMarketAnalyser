import os
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from config.settings import settings

logger = logging.getLogger("AIEquityResearchPlatform")

class FeatureStore:
    """
    Central Repository for Stock Features.
    Loads and stores calculated features as Apache Parquet files.
    Allows incremental columns enrichment with custom schema metadata.
    """
    def __init__(self, features_dir: str = settings.FEATURES_DIR):
        self.features_dir = features_dir
        os.makedirs(self.features_dir, exist_ok=True)

    def get_feature_path(self, ticker: str) -> str:
        """Returns the absolute file path for a ticker's Parquet file."""
        safe_name = ticker.replace("^", "INDEX_").replace(".", "_")
        return os.path.join(self.features_dir, f"{safe_name}.parquet")

    def load_features(self, ticker: str) -> Optional[pd.DataFrame]:
        """
        Loads the features DataFrame for a given ticker from Parquet.
        Returns None if the file does not exist.
        """
        path = self.get_feature_path(ticker)
        if not os.path.exists(path):
            logger.info(f"No features Parquet file found for {ticker} at {path}", extra={"ticker": ticker})
            return None

        try:
            df = pd.read_parquet(path)
            
            # Drop any lingering index level columns from old corrupt schema formats
            cols_to_drop = [c for c in df.columns if c.startswith("__index_level_")]
            if cols_to_drop:
                df.drop(columns=cols_to_drop, inplace=True, errors="ignore")

            # Restore Date as index
            if "Date" in df.columns:
                df["Date"] = pd.to_datetime(df["Date"])
                df.set_index("Date", inplace=True)
            elif "index" in df.columns:
                df["index"] = pd.to_datetime(df["index"])
                df.set_index("index", inplace=True)
                df.index.name = "Date"

            logger.info(f"Successfully loaded {len(df.columns)} features for {ticker}", extra={"ticker": ticker})
            return df
        except Exception as e:
            logger.error(f"Failed to read Parquet features for {ticker}: {e}", extra={"ticker": ticker})
            return None

    def load_metadata(self, ticker: str) -> Dict[str, Any]:
        """
        Retrieves custom metadata dictionary from the Parquet schema.
        """
        path = self.get_feature_path(ticker)
        if not os.path.exists(path):
            return {}

        try:
            schema = pq.read_schema(path)
            meta_bytes = schema.metadata or {}
            metadata = {}
            for k, v in meta_bytes.items():
                key_str = k.decode("utf-8")
                val_str = v.decode("utf-8")
                try:
                    metadata[key_str] = json.loads(val_str)
                except json.JSONDecodeError:
                    metadata[key_str] = val_str
            return metadata
        except Exception as e:
            logger.error(f"Failed to load Parquet metadata for {ticker}: {e}", extra={"ticker": ticker})
            return {}

    def save_features(self, ticker: str, df: pd.DataFrame, metadata: Dict[str, Any]) -> None:
        """
        Saves a DataFrame and its metadata to the Parquet Feature Store.
        """
        if df.empty:
            logger.warning(f"Attempted to save empty features DataFrame for {ticker}", extra={"ticker": ticker})
            return

        path = self.get_feature_path(ticker)
        try:
            # Copy to avoid side effects
            df_to_save = df.copy()
            
            # Drop index columns from dataframe body if they somehow got in
            cols_to_drop = [c for c in df_to_save.columns if c.startswith("__index_level_")]
            if cols_to_drop:
                df_to_save.drop(columns=cols_to_drop, inplace=True, errors="ignore")

            # Ensure index name is set to Date and is DatetimeIndex
            df_to_save.index.name = "Date"
            if not isinstance(df_to_save.index, pd.DatetimeIndex):
                df_to_save.index = pd.to_datetime(df_to_save.index)

            # Reset index to write Date as a regular column in Parquet
            df_to_save.reset_index(inplace=True)

            # Convert to PyArrow Table (disabling index serialization to avoid duplicates)
            table = pa.Table.from_pandas(df_to_save, preserve_index=False)
            
            # Prepare metadata
            serializable_meta = {}
            for k, v in metadata.items():
                if isinstance(v, (dict, list, bool, int, float)):
                    serializable_meta[k] = json.dumps(v)
                else:
                    serializable_meta[k] = str(v)

            # Preserve any existing schema metadata
            existing_meta = table.schema.metadata or {}
            merged_meta = {}
            for k, v in existing_meta.items():
                k_decoded = k.decode("utf-8") if isinstance(k, bytes) else k
                v_decoded = v.decode("utf-8") if isinstance(v, bytes) else v
                merged_meta[k_decoded] = v_decoded
            
            merged_meta.update(serializable_meta)
            
            # Cast all keys/values to bytes for PyArrow Table
            binary_meta = {}
            for k, v in merged_meta.items():
                k_bytes = k.encode("utf-8") if isinstance(k, str) else k
                v_bytes = v.encode("utf-8") if isinstance(v, str) else v
                binary_meta[k_bytes] = v_bytes
            
            # Replace schema and write file
            table = table.replace_schema_metadata(binary_meta)
            pq.write_table(table, path)
            logger.info(f"Saved Feature Store for {ticker} to {path}", extra={"ticker": ticker})
        except Exception as e:
            logger.error(f"Failed to save Parquet features for {ticker}: {e}", extra={"ticker": ticker})
            raise

    def enrich_features(self, ticker: str, new_features_df: pd.DataFrame, stage_name: str) -> pd.DataFrame:
        """
        Incrementally enriches the existing Feature Store DataFrame with new columns.
        If no Feature Store exists, initializes it with new_features_df.
        """
        existing_df = self.load_features(ticker)
        existing_metadata = self.load_metadata(ticker)

        if existing_df is None:
            logger.info(f"Initializing new Feature Store for {ticker} during {stage_name}", extra={"ticker": ticker})
            combined_df = new_features_df.copy()
            # Ensure DatetimeIndex
            if not isinstance(combined_df.index, pd.DatetimeIndex):
                combined_df.index = pd.to_datetime(combined_df.index)
            combined_df.index.name = "Date"
        else:
            # Drop columns in new_features_df if they already exist in existing_df to avoid duplication
            overlapping_cols = [col for col in new_features_df.columns if col in existing_df.columns]
            if overlapping_cols:
                logger.debug(
                    f"Overwriting overlapping columns {overlapping_cols} for ticker {ticker} in stage {stage_name}", 
                    extra={"ticker": ticker}
                )
                existing_df.drop(columns=overlapping_cols, inplace=True, errors="ignore")
            
            # Join columns along date index (ensure both indices are DatetimeIndex)
            if not isinstance(existing_df.index, pd.DatetimeIndex):
                existing_df.index = pd.to_datetime(existing_df.index)
            if not isinstance(new_features_df.index, pd.DatetimeIndex):
                new_features_df.index = pd.to_datetime(new_features_df.index)
                
            existing_df.index.name = "Date"
            new_features_df.index.name = "Date"
            combined_df = existing_df.join(new_features_df, how="outer")

        # Update metadata dictionary
        updated_metadata = existing_metadata.copy()
        
        # Log this stage's execution metadata
        stage_info = {
            "timestamp": datetime.utcnow().isoformat(),
            "columns": list(new_features_df.columns),
            "row_count": len(new_features_df)
        }
        updated_metadata[f"stage_{stage_name}"] = stage_info
        
        # Save enriched dataframe
        self.save_features(ticker, combined_df, updated_metadata)
        return combined_df
