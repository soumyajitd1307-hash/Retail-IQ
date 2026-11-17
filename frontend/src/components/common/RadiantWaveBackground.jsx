import React from 'react';

/**
 * RadiantWaveBackground
 * Signature visual element of Retail IQ:
 * Continuous, smooth, luminous emerald and olive green flowing radiant waves
 * across an obsidian-black backdrop with organic atmospheric depth.
 */
export default function RadiantWaveBackground() {
  return (
    <div 
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#10120F]"
      aria-hidden="true"
    >
      {/* 1. Deep Atmospheric Gradient Underlay */}
      <div 
        className="absolute inset-0 opacity-80"
        style={{
          background: 'radial-gradient(circle at 15% 25%, #263326 0%, #10120F 55%, #0B0D0A 100%)',
        }}
      />

      {/* 2. Floating Radiant Emerald Energy Orbs (Atmospheric glow) */}
      <div className="absolute inset-0">
        {/* Top-Right Emerald Aurora */}
        <div 
          className="absolute -top-32 right-[-5%] w-[850px] h-[750px] rounded-full opacity-45 pointer-events-none radiant-orb-1"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(40, 166, 106, 0.38) 0%, rgba(23, 107, 69, 0.22) 45%, rgba(16, 18, 15, 0) 70%)',
            filter: 'blur(75px)',
          }}
        />

        {/* Center-Left Luminous Olive Energy Pool */}
        <div 
          className="absolute top-[28%] -left-36 w-[800px] h-[700px] rounded-full opacity-40 pointer-events-none radiant-orb-2"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(125, 171, 101, 0.32) 0%, rgba(40, 166, 106, 0.18) 50%, rgba(16, 18, 15, 0) 75%)',
            filter: 'blur(80px)',
          }}
        />

        {/* Bottom Radiant Horizon Glow */}
        <div 
          className="absolute -bottom-48 left-[20%] w-[1000px] h-[650px] rounded-full opacity-35 pointer-events-none radiant-orb-3"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(23, 107, 69, 0.35) 0%, rgba(38, 51, 38, 0.25) 50%, rgba(16, 18, 15, 0) 80%)',
            filter: 'blur(85px)',
          }}
        />
      </div>

      {/* 3. Dimensional Luminous Radiant Waves (Layered SVG Ribbons with Fluid Sine Motion) */}
      <div className="absolute inset-0 opacity-70 mix-blend-screen">
        {/* WAVE LAYER 1: Primary Emerald Radiant Wave Ribbon */}
        <svg 
          className="absolute inset-0 w-full h-full radiant-wave-layer-1" 
          viewBox="0 0 1440 900" 
          preserveAspectRatio="none"
          fill="none"
        >
          <defs>
            <linearGradient id="emeraldWaveGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10120F" stopOpacity="0" />
              <stop offset="25%" stopColor="#176B45" stopOpacity="0.55" />
              <stop offset="55%" stopColor="#28A66A" stopOpacity="0.85" />
              <stop offset="75%" stopColor="#7DAB65" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#10120F" stopOpacity="0" />
            </linearGradient>
            <filter id="waveGlow1" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <path
            d="M-100,280 C240,120 480,480 820,290 C1160,100 1340,380 1600,220 L1600,600 C1340,750 1120,490 820,620 C520,750 200,420 -100,580 Z"
            fill="url(#emeraldWaveGrad1)"
            filter="url(#waveGlow1)"
            opacity="0.75"
          />
        </svg>

        {/* WAVE LAYER 2: Radiant Crest Wave Ribbon (Slightly Offset Frequency) */}
        <svg 
          className="absolute inset-0 w-full h-full radiant-wave-layer-2" 
          viewBox="0 0 1440 900" 
          preserveAspectRatio="none"
          fill="none"
        >
          <defs>
            <linearGradient id="luminousWaveGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10120F" stopOpacity="0" />
              <stop offset="20%" stopColor="#7DAB65" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#28A66A" stopOpacity="0.8" />
              <stop offset="80%" stopColor="#176B45" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#10120F" stopOpacity="0" />
            </linearGradient>
            <filter id="waveGlow2" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="14" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <path
            d="M-50,490 C320,650 620,280 980,480 C1340,680 1420,320 1550,420 L1550,780 C1380,620 1100,820 860,690 C620,560 280,820 -50,680 Z"
            fill="url(#luminousWaveGrad2)"
            filter="url(#waveGlow2)"
            opacity="0.65"
          />
        </svg>

        {/* WAVE LAYER 3: Fine Specular Caustic Light Threads */}
        <svg 
          className="absolute inset-0 w-full h-full radiant-wave-layer-3" 
          viewBox="0 0 1440 900" 
          preserveAspectRatio="none"
          fill="none"
        >
          <defs>
            <linearGradient id="causticThreadGrad" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#28A66A" stopOpacity="0" />
              <stop offset="35%" stopColor="#7DAB65" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#C6AD70" stopOpacity="0.95" />
              <stop offset="65%" stopColor="#28A66A" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#176B45" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Thin flowing luminous crest line 1 */}
          <path
            d="M-100,280 C240,120 480,480 820,290 C1160,100 1340,380 1600,220"
            stroke="url(#causticThreadGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.75"
          />
          {/* Thin flowing luminous crest line 2 */}
          <path
            d="M-50,490 C320,650 620,280 980,480 C1340,680 1420,320 1550,420"
            stroke="url(#causticThreadGrad)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.6"
          />
        </svg>
      </div>

      {/* 4. Fine Atmospheric Vignette Edge (Preserves perimeter depth without clipping wave) */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, transparent 40%, rgba(16, 18, 15, 0.45) 85%, rgba(11, 13, 10, 0.75) 100%)',
        }}
      />
    </div>
  );
}
