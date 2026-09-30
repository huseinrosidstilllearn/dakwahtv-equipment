import React from 'react';
import { Camera, Radio, Lightbulb, Video, Mic, Disc3 } from 'lucide-react';

const HIGHLIGHT_EQUIPMENT = [
  { name: 'Sony FX3 Cinema Line', cat: 'Kamera', icon: Camera, status: 'Ready' },
  { name: 'Sony FE 24-70mm F2.8 GM II', cat: 'Lensa', icon: Disc3, status: 'Ready' },
  { name: 'Rode Wireless PRO', cat: 'Audio', icon: Radio, status: 'Ready' },
  { name: 'Aputure Amaran 200d', cat: 'Lighting', icon: Lightbulb, status: 'Ready' },
  { name: 'DJI Ronin RS3 Pro', cat: 'Stabilizer', icon: Video, status: 'Ready' },
  { name: 'Sony FE 70-200mm F2.8 GM', cat: 'Lensa', icon: Disc3, status: 'Ready' },
  { name: 'Sennheiser MKE 600 Shotgun', cat: 'Audio', icon: Mic, status: 'Ready' },
  { name: 'Hollyland Mars 400S Pro', cat: 'Wireless Video', icon: Radio, status: 'Ready' },
  { name: 'Tripod Libec TH-X', cat: 'Rigging', icon: Video, status: 'Ready' },
  { name: 'Nanlite Forza 60B Bi-Color', cat: 'Lighting', icon: Lightbulb, status: 'Ready' },
];

export function EquipmentMarquee() {
  return (
    <div className="relative w-full overflow-hidden py-4 border-y border-border/50 bg-background/50 backdrop-blur-md">
      {/* Edge Gradient Fades */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-l from-background to-transparent" />

      {/* Marquee Track */}
      <div className="flex w-max animate-marquee space-x-6 hover:[animation-play-state:paused]">
        {[...HIGHLIGHT_EQUIPMENT, ...HIGHLIGHT_EQUIPMENT].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-card/60 border border-border text-xs text-foreground/80 hover:text-foreground hover:border-primary/40 transition-all shadow-sm flex-shrink-0"
            >
              <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-foreground">{item.name}</span>
              <span className="text-[10px] text-foreground/50 font-mono">({item.cat})</span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {item.status}
              </span>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 35s linear infinite;
        }
      `}</style>
    </div>
  );
}
