import React, { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';

export default function IntroAnimation({ onComplete }) {
  // Animation stages:
  // 0: Cart enters from left -> center (0s - 1.2s)
  // 1: Bag pops out of cart (1.2s - 2.2s)
  // 2: Coupon emerges from bag (2.2s - 3.2s)
  // 3: Blast explosion (3.2s - 3.9s)
  // 4: Smooth fade-out to dashboard (3.9s - 4.4s)
  const [stage, setStage] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Stage 1: Bag pops out
    const timer1 = setTimeout(() => {
      setStage(1);
    }, 1200);

    // Stage 2: Coupon emerges
    const timer2 = setTimeout(() => {
      setStage(2);
    }, 2200);

    // Stage 3: Coupon blast explosion
    const timer3 = setTimeout(() => {
      setStage(3);
    }, 3200);

    // Stage 4: Fade out intro
    const timer4 = setTimeout(() => {
      setIsFadingOut(true);
    }, 3900);

    // End: Complete & unmount
    const timer5 = setTimeout(() => {
      if (onComplete) onComplete();
    }, 4500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);
    };
  }, [onComplete]);

  // Generate confetti burst particles with champagne gold, luminous olive, antique brass, and sage
  const particles = Array.from({ length: 44 }).map((_, i) => {
    const angle = (i / 44) * 360 + (i % 2 === 0 ? 5 : -5);
    const rad = (angle * Math.PI) / 180;
    const distance = 120 + (i % 7) * 45;
    const x = Math.cos(rad) * distance;
    const y = Math.sin(rad) * distance;
    const size = 6 + (i % 5) * 3;
    const colors = [
      '#FFF1C5', // Light Gold
      '#D5B66E', // Champagne Gold
      '#B99A55', // Metallic Gold
      '#A5B86A', // Luminous Olive
      '#81966B', // Soft Sage
      '#A18A52', // Antique Brass
      '#FFA085', // Warm Coral
      '#EAE7DB', // Warm Ivory
    ];
    const color = colors[i % colors.length];
    const isStar = i % 3 === 0;
    const isRibbon = i % 4 === 1;

    return {
      id: i,
      x,
      y,
      size,
      color,
      isStar,
      isRibbon,
      delay: (i % 6) * 15,
      rotation: (i * 37) % 360,
    };
  });

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden transition-all duration-700 ease-out select-none ${
        isFadingOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        background: 'radial-gradient(circle at center, #262c20 0%, #171913 65%, #0e100c 100%)',
      }}
    >
      {/* Ambient background light orbs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-[#D5B66E]/12 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-[#A5B86A]/12 rounded-full blur-3xl animate-pulse pointer-events-none" />

      {/* Skip Button in Top Right */}
      <button
        onClick={() => {
          setIsFadingOut(true);
          setTimeout(() => {
            if (onComplete) onComplete();
          }, 300);
        }}
        className="absolute top-6 right-6 z-50 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#303629]/60 hover:bg-[#303629] text-[#FFF3D1] text-xs font-bold backdrop-blur-md border border-[#A18A52]/30 transition-all shadow-lg group cursor-pointer"
      >
        <span>Skip Intro</span>
        <X className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform text-[#D5B66E]" />
      </button>

      {/* Main Animation Stage Centerpiece */}
      <div className="relative w-80 h-80 flex items-center justify-center">
        {/* Ground glow shadow under the cart */}
        <div
          className={`absolute bottom-6 w-52 h-6 bg-[#A5B86A]/20 rounded-full blur-md transition-all duration-1000 ${
            stage >= 0 ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
          } ${stage >= 3 ? 'opacity-0 scale-150 duration-300' : ''}`}
        />

        {/* 1. SHOPPING CART (Metallic Gold & Deep Olive finish) */}
        <div
          className={`absolute z-10 transition-all duration-1000 ${
            stage === 0
              ? 'animate-cart-enter'
              : stage >= 3
              ? 'opacity-0 scale-90 duration-300'
              : 'translate-x-0'
          }`}
          style={{
            animation: stage === 0 ? 'cartRollIn 1.1s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none',
          }}
        >
          {/* Shopping Cart SVG Artwork */}
          <div className="relative w-44 h-36">
            <svg
              viewBox="0 0 160 130"
              className="w-full h-full drop-shadow-[0_8px_20px_rgba(0,0,0,0.8)] overflow-visible"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="cartGoldMetal" x1="0" y1="0" x2="160" y2="130" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FFF1C5" />
                  <stop offset="0.5" stopColor="#D5B66E" />
                  <stop offset="1" stopColor="#B99A55" />
                </linearGradient>
                <linearGradient id="cartHandleGold" x1="0" y1="0" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#D5B66E" />
                  <stop offset="1" stopColor="#A18A52" />
                </linearGradient>
                <linearGradient id="wheelRimGold" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#A5B86A" />
                  <stop offset="1" stopColor="#303629" />
                </linearGradient>
              </defs>

              {/* Push Handle Bar */}
              <path
                d="M18 20 H40 L48 42"
                stroke="url(#cartHandleGold)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="20" cy="20" r="4" fill="#D5B66E" />

              {/* Basket Frame Outer */}
              <path
                d="M48 42 H142 L128 86 H62 L48 42 Z"
                stroke="url(#cartGoldMetal)"
                strokeWidth="4"
                strokeLinejoin="round"
                fill="rgba(48, 54, 41, 0.35)"
              />

              {/* Basket Horizontal Wire Grids */}
              <line x1="53" y1="56" x2="137" y2="56" stroke="#D5B66E" strokeWidth="2" strokeDasharray="3 2" opacity="0.8" />
              <line x1="58" y1="71" x2="132" y2="71" stroke="#D5B66E" strokeWidth="2" strokeDasharray="3 2" opacity="0.8" />

              {/* Basket Vertical Wire Grids */}
              <line x1="72" y1="44" x2="77" y2="84" stroke="#A5B86A" strokeWidth="2" opacity="0.6" />
              <line x1="94" y1="44" x2="96" y2="84" stroke="#A5B86A" strokeWidth="2" opacity="0.6" />
              <line x1="116" y1="44" x2="115" y2="84" stroke="#A5B86A" strokeWidth="2" opacity="0.6" />

              {/* Lower Chassis / Tray */}
              <path
                d="M58 86 L66 104 H120"
                stroke="#B99A55"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Front Wheel Mount */}
              <line x1="118" y1="104" x2="118" y2="112" stroke="#B99A55" strokeWidth="3" />
              {/* Rear Wheel Mount */}
              <line x1="68" y1="104" x2="68" y2="112" stroke="#B99A55" strokeWidth="3" />

              {/* Front Wheel (Spinning) */}
              <g
                className={stage === 0 ? 'animate-spin' : ''}
                style={{ transformOrigin: '118px 116px', animationDuration: '0.6s' }}
              >
                <circle cx="118" cy="116" r="10" fill="#10120F" stroke="url(#wheelRimGold)" strokeWidth="3" />
                <circle cx="118" cy="116" r="4" fill="#D5B66E" />
                <line x1="118" y1="108" x2="118" y2="124" stroke="#EAE7DB" strokeWidth="1.5" />
                <line x1="110" y1="116" x2="126" y2="116" stroke="#EAE7DB" strokeWidth="1.5" />
              </g>

              {/* Rear Wheel (Spinning) */}
              <g
                className={stage === 0 ? 'animate-spin' : ''}
                style={{ transformOrigin: '68px 116px', animationDuration: '0.6s' }}
              >
                <circle cx="68" cy="116" r="10" fill="#10120F" stroke="url(#wheelRimGold)" strokeWidth="3" />
                <circle cx="68" cy="116" r="4" fill="#D5B66E" />
                <line x1="68" y1="108" x2="68" y2="124" stroke="#EAE7DB" strokeWidth="1.5" />
                <line x1="60" y1="116" x2="76" y2="116" stroke="#EAE7DB" strokeWidth="1.5" />
              </g>
            </svg>
          </div>
        </div>

        {/* 2. SHOPPING BAG (Luxury Olive-Gold finish) */}
        <div
          className={`absolute z-20 transition-all duration-700 ease-out ${
            stage === 0
              ? 'opacity-0 scale-0 translate-y-10'
              : stage === 1
              ? 'opacity-100 -translate-y-16 scale-110'
              : stage === 2
              ? 'opacity-100 -translate-y-14 scale-100'
              : 'opacity-0 scale-75 duration-300'
          }`}
          style={{
            animation:
              stage === 1
                ? 'bagPopOut 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
                : 'none',
          }}
        >
          <div className="relative w-28 h-32 flex items-center justify-center">
            {/* Shopping Bag SVG */}
            <svg
              viewBox="0 0 100 120"
              className="w-full h-full drop-shadow-[0_12px_24px_rgba(0,0,0,0.8)] overflow-visible"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="bagLuxuryGradient" x1="0" y1="0" x2="100" y2="120" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#303629" />
                  <stop offset="0.5" stopColor="#414b38" />
                  <stop offset="1" stopColor="#1e221a" />
                </linearGradient>
                <linearGradient id="handleLuxuryGold" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FFF1C5" />
                  <stop offset="1" stopColor="#B99A55" />
                </linearGradient>
              </defs>

              {/* Bag Handles (Golden cord) */}
              <path
                d="M32 38 C32 12, 68 12, 68 38"
                stroke="url(#handleLuxuryGold)"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
              />

              {/* Main Bag Body */}
              <path
                d="M16 38 H84 L78 112 H22 L16 38 Z"
                fill="url(#bagLuxuryGradient)"
                stroke="#D5B66E"
                strokeWidth="1.5"
              />

              {/* Bag Top Fold Crease */}
              <path d="M16 38 L22 46 H78 L84 38" fill="rgba(0,0,0,0.3)" />

              {/* Brand Emblem on Bag */}
              <rect x="36" y="58" width="28" height="28" rx="6" fill="#10120F" stroke="#D5B66E" strokeWidth="1" />
              <path
                d="M44 65 H52 L56 71 L52 79 H44 V65 Z"
                fill="#A5B86A"
              />
              <circle cx="53" cy="76" r="2.5" fill="#D5B66E" />
            </svg>

            {/* Sparkles around bag when it pops */}
            {stage >= 1 && stage < 3 && (
              <>
                <Sparkles className="absolute -top-3 -right-2 w-6 h-6 text-[#D5B66E] animate-spin" style={{ animationDuration: '3s' }} />
                <Sparkles className="absolute -bottom-1 -left-3 w-5 h-5 text-[#A5B86A] animate-pulse" />
              </>
            )}
          </div>
        </div>

        {/* 3. COUPON (Emerges from bag, floats into spotlight, glows) */}
        <div
          className={`absolute z-30 transition-all duration-700 ease-out ${
            stage < 2
              ? 'opacity-0 scale-50 translate-y-0 pointer-events-none'
              : stage === 2
              ? 'opacity-100 -translate-y-28 scale-110'
              : 'opacity-0 scale-150 duration-200'
          }`}
          style={{
            animation:
              stage === 2
                ? 'couponFloat 1s cubic-bezier(0.2, 0.8, 0.2, 1) forwards'
                : 'none',
          }}
        >
          {/* Golden VIP Coupon Ticket */}
          <div className="relative w-56 p-4 rounded-xl bg-gradient-to-r from-[#FFF1C5] via-[#D5B66E] to-[#B99A55] text-[#10120F] shadow-[0_12px_40px_rgba(213,182,110,0.4)] border-2 border-[#FFF3D1] flex flex-col items-center justify-center transform hover:scale-105 transition-transform">
            {/* Holographic glowing sheen overlay */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-transparent via-white/40 to-transparent pointer-events-none" />

            {/* Perforated ticket edges (left & right cutouts) */}
            <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-[#171913] rounded-full" />
            <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-[#171913] rounded-full" />

            {/* Dashed divider border */}
            <div className="w-full border-b-2 border-dashed border-[#8A723D]/40 pb-2 mb-2 flex items-center justify-between">
              <span className="text-[10px] font-extrabold tracking-wider text-[#303629] uppercase">
                ★ SPECIAL UNLOCK ★
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#10120F] text-[#FFF1C5]">
                100% VIP
              </span>
            </div>

            <div className="text-center space-y-0.5">
              <div className="text-base font-black tracking-tight text-[#10120F] flex items-center justify-center gap-1">
                <span>RETAIL</span>
                <span className="text-[#303629] font-extrabold">IQ</span>
                <span className="text-xs bg-[#10120F] text-[#D5B66E] font-bold px-1 rounded">2026</span>
              </div>
              <p className="text-[11px] font-extrabold text-[#262c20] uppercase tracking-wide">
                CUSTOMER INTELLIGENCE UNLOCKED
              </p>
            </div>

            <div className="w-full mt-2 pt-1 border-t border-[#8A723D]/30 flex items-center justify-between text-[9px] font-mono text-[#303629]">
              <span>PROMO: ALL-SEGMENTS</span>
              <span>||| |||| || |||</span>
            </div>
          </div>
        </div>

        {/* 4. BLAST PARTICLES & SHOCKWAVE EXPLOSION (Stage 3) */}
        {stage >= 3 && (
          <div className="absolute z-40 inset-0 flex items-center justify-center pointer-events-none">
            {/* Shockwave expanding ring 1 */}
            <div
              className="absolute rounded-full border-4 border-[#D5B66E] opacity-90 animate-ping"
              style={{
                width: '320px',
                height: '320px',
                animationDuration: '0.8s',
              }}
            />
            {/* Shockwave expanding ring 2 */}
            <div
              className="absolute rounded-full border-2 border-[#A5B86A] opacity-70 animate-ping"
              style={{
                width: '420px',
                height: '420px',
                animationDuration: '1s',
                animationDelay: '0.1s',
              }}
            />

            {/* Glowing core blast flash */}
            <div className="absolute w-32 h-32 rounded-full bg-radial from-white via-[#D5B66E] to-transparent blur-xl animate-pulse" />

            {/* Radial Confetti and Sparkle Particles */}
            {particles.map((p) => (
              <div
                key={p.id}
                className="absolute"
                style={{
                  transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rotation}deg)`,
                  transition: 'all 0.65s cubic-bezier(0.12, 0.8, 0.32, 1)',
                  opacity: 0,
                  animation: `particleBurst 0.75s ease-out forwards ${p.delay}ms`,
                }}
              >
                {p.isStar ? (
                  <span
                    style={{
                      color: p.color,
                      fontSize: `${p.size + 4}px`,
                      filter: 'drop-shadow(0 0 6px rgba(213,182,110,0.8))',
                    }}
                  >
                    ★
                  </span>
                ) : p.isRibbon ? (
                  <div
                    style={{
                      width: `${p.size * 1.8}px`,
                      height: `${p.size * 0.6}px`,
                      backgroundColor: p.color,
                      borderRadius: '2px',
                      transform: `rotate(${p.rotation * 2}deg)`,
                      boxShadow: `0 0 8px ${p.color}`,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: `${p.size}px`,
                      height: `${p.size}px`,
                      backgroundColor: p.color,
                      borderRadius: '50%',
                      boxShadow: `0 0 8px ${p.color}`,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Subtitle / Brand Indicator */}
      <div
        className={`absolute bottom-10 flex flex-col items-center gap-1.5 transition-opacity duration-500 ${
          stage < 3 ? 'opacity-90' : 'opacity-0'
        }`}
      >
        <div className="flex items-center gap-2 text-[#FFF3D1] text-sm font-bold tracking-wider uppercase">
          <span className="w-2 h-2 rounded-full bg-[#A5B86A] animate-ping" />
          <span>Retail IQ Analytics</span>
        </div>
        <p className="text-xs text-[#EAE7DB]/50">
          {stage === 0 && 'Cart arriving with customer cohort intelligence...'}
          {stage === 1 && 'Shopping bag extracted!'}
          {stage === 2 && 'Unlocking premium predictive coupon...'}
          {stage >= 3 && 'Revealing Dashboard...'}
        </p>
      </div>

      {/* Embedded CSS Keyframes */}
      <style>{`
        @keyframes cartRollIn {
          0% {
            transform: translateX(-120vw) scale(0.9);
            opacity: 0;
          }
          70% {
            transform: translateX(15px) scale(1.02);
            opacity: 1;
          }
          85% {
            transform: translateX(-6px) scale(0.99);
          }
          100% {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
        }

        @keyframes bagPopOut {
          0% {
            transform: translateY(20px) scale(0.3);
            opacity: 0;
          }
          60% {
            transform: translateY(-80px) scale(1.15) rotate(-6deg);
            opacity: 1;
          }
          80% {
            transform: translateY(-60px) scale(0.95) rotate(3deg);
          }
          100% {
            transform: translateY(-68px) scale(1) rotate(0deg);
            opacity: 1;
          }
        }

        @keyframes couponFloat {
          0% {
            transform: translateY(-40px) scale(0.4) rotate(-10deg);
            opacity: 0;
          }
          65% {
            transform: translateY(-120px) scale(1.15) rotate(4deg);
            opacity: 1;
          }
          85% {
            transform: translateY(-105px) scale(0.98) rotate(-1deg);
          }
          100% {
            transform: translateY(-112px) scale(1) rotate(0deg);
            opacity: 1;
          }
        }

        @keyframes particleBurst {
          0% {
            transform: translate(0, 0) scale(0.2);
            opacity: 1;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: scale(1.2);
          }
        }
      `}</style>
    </div>
  );
}
