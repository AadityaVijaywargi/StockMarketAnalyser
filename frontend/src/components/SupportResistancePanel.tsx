import React from 'react';
import { SRZone } from '../types';
import { Shield, ArrowUp, ArrowDown } from 'lucide-react';
import { formatNumber, formatScore, formatPrice } from '../utils/formatter';

interface SupportResistancePanelProps {
  supportZones: SRZone[];
  resistanceZones: SRZone[];
  currentPrice: number;
}

export const SupportResistancePanel: React.FC<SupportResistancePanelProps> = ({ 
  supportZones = [], 
  resistanceZones = [], 
  currentPrice = 0.0
}) => {
  
  const calculateDistance = (upper: number, lower: number) => {
    const midpoint = (upper + lower) / 2.0;
    const distancePct = currentPrice > 0 ? ((midpoint - currentPrice) / currentPrice) * 100.0 : 0.0;
    return {
      midpoint,
      distancePct,
    };
  };

  return (
    <div className="bg-surface border border-borderDark p-6 rounded-xl flex flex-col gap-5 h-full">
      <div className="flex items-center gap-3 border-b border-borderDark pb-4">
        <div className="w-8 h-8 rounded bg-brand/10 border border-brand/20 flex items-center justify-center">
          <Shield className="w-4 h-4 text-brand" />
        </div>
        <h3 className="font-bold text-base text-white">Support & Resistance Zones</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-h-[380px] overflow-y-auto pr-1">
        {/* Support Zones Panel */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-bullish uppercase font-mono border-b border-borderDark/40 pb-1.5">
            <ArrowDown className="w-3.5 h-3.5" />
            <span>Support Levels</span>
          </div>
          
          {supportZones.length === 0 ? (
            <span className="text-xs text-textMuted font-mono">No support zones detected</span>
          ) : (
            supportZones.map((zone, idx) => {
              const { midpoint, distancePct } = calculateDistance(zone.upper_bound, zone.lower_bound);
              return (
                <div key={idx} className="bg-background border border-borderDark p-3.5 rounded-lg flex items-center justify-between hover:border-bullish/20 transition-all font-mono">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-bullish">{formatPrice(midpoint)}</span>
                    <span className="text-[9px] text-textMuted">Band: {formatScore(zone.lower_bound)} - {formatScore(zone.upper_bound)}</span>
                  </div>
                  
                  <div className="text-right flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-white">{formatNumber(Math.abs(distancePct), 1)}% below CMP</span>
                    <span className="text-[8px] text-textMuted uppercase">Touches: {zone.touches} | Str: {formatScore(zone.strength != null ? zone.strength * 10 : null)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Resistance Zones Panel */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-bearish uppercase font-mono border-b border-borderDark/40 pb-1.5">
            <ArrowUp className="w-3.5 h-3.5" />
            <span>Resistance Levels</span>
          </div>
          
          {resistanceZones.length === 0 ? (
            <span className="text-xs text-textMuted font-mono">No resistance zones detected</span>
          ) : (
            resistanceZones.map((zone, idx) => {
              const { midpoint, distancePct } = calculateDistance(zone.upper_bound, zone.lower_bound);
              return (
                <div key={idx} className="bg-background border border-borderDark p-3.5 rounded-lg flex items-center justify-between hover:border-bearish/20 transition-all font-mono">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-bearish">{formatPrice(midpoint)}</span>
                    <span className="text-[9px] text-textMuted">Band: {formatScore(zone.lower_bound)} - {formatScore(zone.upper_bound)}</span>
                  </div>
                  
                  <div className="text-right flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-white">{formatNumber(distancePct, 1)}% above CMP</span>
                    <span className="text-[8px] text-textMuted uppercase">Touches: {zone.touches} | Str: {formatScore(zone.strength != null ? zone.strength * 10 : null)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
