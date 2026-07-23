import React, { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { ChartData } from '../types';

interface TechnicalChartProps {
  chartData: ChartData;
}

export const TechnicalChart: React.FC<TechnicalChartProps> = ({ chartData }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Initialize Chart layout using official v4.2.3 API
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { type: ColorType.Solid, color: '#111111' },
        textColor: '#8e8e93',
      },
      grid: {
        vertLines: { color: 'rgba(32, 32, 32, 0.5)' },
        horzLines: { color: 'rgba(32, 32, 32, 0.5)' },
      },
      rightPriceScale: {
        borderColor: '#202020',
      },
      timeScale: {
        borderColor: '#202020',
        timeVisible: false,
      },
    });

    // Logging detailed object signatures for diagnostic checks
    console.log("=== DIAGNOSTIC CHART CHECK ===");
    console.log("Chart Object:", chart);
    console.log("Chart Object Type:", typeof chart);
    if (chart) {
      console.log("Chart Prototype Methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(chart)));
      console.log("Chart Keys:", Object.keys(chart));
    }

    chartRef.current = chart;

    // 2. Add Candlestick Series using official v4.2.3 API
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#00b067',
      downColor: '#ff3b30',
      borderVisible: false,
      wickUpColor: '#00b067',
      wickDownColor: '#ff3b30',
    });

    // 3. Map Price Series Data
    const dates = chartData.dates || [];
    const candlePoints = dates.map((d, i) => ({
      time: d,
      open: chartData.open[i] ?? 0.0,
      high: chartData.high[i] ?? 0.0,
      low: chartData.low[i] ?? 0.0,
      close: chartData.close[i] ?? 0.0,
    }));

    candlestickSeries.setData(candlePoints);

    // 4. Auto fit content
    chart.timeScale().fitContent();

    // 5. Handle Resizing
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.resize(containerRef.current.clientWidth, 400);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [chartData]);

  return (
    <div className="bg-surface border border-borderDark p-6 rounded-xl flex flex-col gap-4">
      <div className="flex justify-between items-center border-b border-borderDark pb-4">
        <div>
          <h3 className="font-bold text-base text-white">Interactive Chart</h3>
          <p className="text-xs text-textMuted mt-0.5">Candlestick chart rendering OHLC candles</p>
        </div>
      </div>
      
      {/* Chart container */}
      <div ref={containerRef} className="w-full relative h-[400px] bg-background rounded-lg overflow-hidden border border-borderDark" />
    </div>
  );
};
