import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, FileText } from 'lucide-react';

// Pseudo-random generator for repeatable physics across fragments
function pseudoRandom(seed) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// 20 Irregular Polygon Paper Fragments (covering screen quadrants with torn-edge geometry)
const PAPER_FRAGMENTS = Array.from({ length: 20 }).map((_, i) => {
  const col = i % 5;
  const row = Math.floor(i / 5);

  const centerX = 2; // 0 to 4
  const centerY = 1.5; // 0 to 3

  const r1 = pseudoRandom(i * 17 + 3);
  const r2 = pseudoRandom(i * 23 + 7);
  const r3 = pseudoRandom(i * 31 + 11);
  const r4 = pseudoRandom(i * 37 + 13);
  const r5 = pseudoRandom(i * 41 + 19);
  const r6 = pseudoRandom(i * 43 + 23);

  // Direction vector radiating outwards from center
  const dirX = col - centerX + (r1 - 0.5) * 0.9;
  const dirY = row - centerY + (r2 - 0.5) * 0.9;

  // Upward and outward natural paper aerodynamics
  const distance = 240 + r3 * 280;
  const tx = dirX * (distance * 0.95) + (r4 - 0.5) * 80;
  // Upward bias: paper flies predominantly up and out like draft wind
  const ty = -140 + dirY * (distance * 0.8) - r5 * 180;
  const tz = 50 + r6 * 200;

  // Varied organic rotation angles (paper fluttering in wind)
  const rotZ = (r1 - 0.5) * 75; // -37deg to +37deg
  const rotX = (r2 - 0.5) * 50; // -25deg to +25deg
  const rotY = (r3 - 0.5) * 60; // -30deg to +30deg

  // Staggered timing: epicenter bursts first, outer edges follow
  const distFromCenter = Math.sqrt(dirX * dirX + dirY * dirY);
  const delay = Math.round(distFromCenter * 35); // 0 to ~110ms

  // Unique irregular polygon clip-paths for torn deckle-edge paper look
  const polygonShapes = [
    'polygon(2% 4%, 96% 0%, 100% 92%, 4% 98%)',
    'polygon(0% 2%, 98% 6%, 92% 100%, 5% 94%)',
    'polygon(6% 0%, 100% 3%, 94% 98%, 0% 90%)',
    'polygon(0% 0%, 95% 4%, 100% 95%, 6% 100%)',
    'polygon(4% 0%, 100% 5%, 90% 96%, 0% 92%)',
    'polygon(0% 8%, 98% 0%, 94% 100%, 2% 95%)',
    'polygon(3% 0%, 100% 4%, 96% 94%, 0% 100%)',
    'polygon(0% 0%, 96% 6%, 100% 100%, 4% 92%)',
  ];
  const clipPath = polygonShapes[i % polygonShapes.length];

  // Paper surface graphics/shading for authentic analytical document illusion
  const paperTextures = [
    'bg-gradient-to-br from-[#FFFDF8] via-[#F6F0E2] to-[#E9DFCB]',
    'bg-gradient-to-br from-[#FDFBF7] via-[#F4EDE0] to-[#E5DBC5]',
    'bg-gradient-to-br from-[#FFFFFF] via-[#F8F3E8] to-[#ECE2D0]',
    'bg-gradient-to-br from-[#FFFDF9] via-[#F5EFE3] to-[#E8DECA]',
  ];
  const paperTexture = paperTextures[i % paperTextures.length];

  return {
    id: i,
    col,
    row,
    tx,
    ty,
    tz,
    rotX,
    rotY,
    rotZ,
    delay,
    clipPath,
    paperTexture,
  };
});

export default function ShatterTransition({ isShattering, targetUrl, onComplete }) {
  // Phase 0: Smooth scroll to top (0ms - 360ms)
  // Phase 1: Realistic paper shatter (360ms - 900ms)
  // Phase 2: Customer Explorer reveal (900ms - 1450ms)
  // Phase 3: Settle & cleanup (1450ms)
  const [phase, setPhase] = useState('idle'); // 'scrolling' | 'shattering' | 'revealing' | 'done'
  const isNavigatedRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isShattering) {
      setPhase('idle');
      isNavigatedRef.current = false;
      return;
    }

    // Check for user reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      if (targetUrl) navigate(targetUrl);
      if (onComplete) onComplete();
      return;
    }

    // PHASE 1: Smoothly scroll to top
    setPhase('scrolling');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, behavior: 'smooth' });

    // PHASE 2: Start paper shatter once scroll has reached top
    const shatterTimer = setTimeout(() => {
      setPhase('shattering');
    }, 360);

    // PHASE 3: Navigate to Explorer underneath the floating paper fragments
    const revealTimer = setTimeout(() => {
      setPhase('revealing');
      if (targetUrl && !isNavigatedRef.current) {
        isNavigatedRef.current = true;
        navigate(targetUrl);
      }
    }, 820);

    // PHASE 4: Final settlement & cleanup
    const completeTimer = setTimeout(() => {
      setPhase('done');
      if (onComplete) onComplete();
    }, 1450);

    return () => {
      clearTimeout(shatterTimer);
      clearTimeout(revealTimer);
      clearTimeout(completeTimer);
    };
  }, [isShattering, targetUrl, navigate, onComplete]);

  if (!isShattering || phase === 'idle' || phase === 'done') return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden perspective-[1400px]">
      {/* Dark Ambient Vignette Flash */}
      <div
        className={`absolute inset-0 bg-[#0e100c] transition-opacity duration-400 ease-out ${
          phase === 'scrolling'
            ? 'opacity-0'
            : phase === 'shattering'
            ? 'opacity-70 backdrop-blur-xs'
            : 'opacity-0'
        }`}
      />

      {/* Cinematic Transition Badge Notice */}
      <AnimatePresence>
        {(phase === 'scrolling' || phase === 'shattering') && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="absolute top-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2 rounded-full panel-champagne-lux border border-[#B99A55]/50 shadow-2xl text-[#1A1D16] text-xs font-black tracking-wide"
          >
            <Sparkles className="w-4 h-4 text-[#8A6F27] animate-spin" style={{ animationDuration: '3s' }} />
            <span>Transitioning to Customer Explorer...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Realistic Paper Fragments Jigsaw Container */}
      {phase !== 'scrolling' && (
        <div
          className="absolute inset-2 sm:inset-6 grid grid-cols-5 grid-rows-4 gap-1.5"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {PAPER_FRAGMENTS.map((p) => {
            const isShattered = phase === 'shattering' || phase === 'revealing';
            return (
              <div
                key={p.id}
                className="relative rounded-sm overflow-hidden"
                style={{
                  clipPath: p.clipPath,
                  transformStyle: 'preserve-3d',
                  transform: isShattered
                    ? `translate3d(${p.tx}px, ${p.ty}px, ${p.tz}px) rotateX(${p.rotX}deg) rotateY(${p.rotY}deg) rotateZ(${p.rotZ}deg) scale(0.65)`
                    : 'translate3d(0, 0, 0) rotate(0deg) scale(1)',
                  opacity: phase === 'shattering' ? 1 : 0,
                  transition: `transform 0.85s cubic-bezier(0.18, 0.9, 0.32, 1) ${p.delay}ms, opacity 0.45s ease-out ${p.delay + 300}ms`,
                  filter: isShattered
                    ? 'drop-shadow(0 18px 24px rgba(0,0,0,0.55)) drop-shadow(0 4px 8px rgba(0,0,0,0.35))'
                    : 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                }}
              >
                {/* Textured Luxury Bond Paper Tile with Analytical Print Graphics */}
                <div
                  className={`w-full h-full ${p.paperTexture} p-3 flex flex-col justify-between border-t border-l border-white/80 shadow-inner select-none relative`}
                >
                  {/* Subtle deckle edge bevel reflection */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent pointer-events-none" />

                  {/* Top Header Simulation on Paper */}
                  <div className="flex items-center justify-between opacity-80">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#059669]" />
                      <span className="text-[9px] font-black font-mono text-[#1A1D16]">RETAIL IQ</span>
                    </div>
                    <span className="text-[8px] font-mono text-[#8A6F27] font-bold">K=4 • RFM-P</span>
                  </div>

                  {/* Middle Chart Graphic Simulation on Paper */}
                  <div className="space-y-1.5 my-1">
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-12 rounded-full bg-[#059669]/60" />
                      <div className="h-1.5 w-7 rounded-full bg-[#D97706]/60" />
                      <div className="h-1.5 w-5 rounded-full bg-[#E11D48]/60" />
                    </div>
                    <div className="h-1 w-full bg-[#303629]/15 rounded" />
                    <div className="h-1 w-3/4 bg-[#303629]/10 rounded" />
                  </div>

                  {/* Bottom Persona Metric Stamp on Paper */}
                  <div className="flex justify-between items-center text-[8px] font-mono font-bold text-[#303629]/70 pt-1 border-t border-[#B99A55]/20">
                    <span>Cluster #{p.id % 4}</span>
                    <span className="text-[#8A6F27]">{p.id % 2 === 0 ? '59.7% Rev' : '200 Cohort'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
