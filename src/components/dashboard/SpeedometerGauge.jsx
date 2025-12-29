import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function SpeedometerGauge({ 
  projectedBalance, 
  riskLevel = 'green',
  riskDay,
  whatIfAmount = 0,
  safetyBuffer = 0.17
}) {
  const adjustedBalance = projectedBalance - whatIfAmount;
  
  const { angle, color, status, isGreen } = useMemo(() => {
    let calculatedStatus = riskLevel;
    
    if (adjustedBalance < 0) {
      calculatedStatus = 'red';
    } else if (adjustedBalance < 1000) {
      calculatedStatus = 'yellow';
    } else {
      calculatedStatus = 'green';
    }
    
    const statusConfig = {
      green: { angle: 45, color: '#10b981', status: 'בטוח', isGreen: true },
      yellow: { angle: 0, color: '#f59e0b', status: 'זהירות', isGreen: false },
      red: { angle: -45, color: '#ef4444', status: 'סיכון', isGreen: false }
    };
    
    return statusConfig[calculatedStatus];
  }, [adjustedBalance, riskLevel]);

  return (
    <div className="relative flex flex-col items-center justify-center py-12">
      {/* Premium SVG Gauge */}
      <div className="relative flex items-center justify-center w-full">
        <svg 
          viewBox="0 0 260 150" 
          className="w-full max-w-[340px] md:max-w-[400px]"
          style={{ filter: 'drop-shadow(0 4px 20px rgba(0, 0, 0, 0.5))' }}
        >
          <defs>
            {/* Gradient Mask - Smooth flow from Red -> Amber -> Emerald */}
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="15%" stopColor="#ef4444" />
              <stop offset="35%" stopColor="#f59e0b" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="65%" stopColor="#84cc16" />
              <stop offset="85%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            {/* Needle shadow */}
            <filter id="needleShadow">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
              <feOffset dx="0" dy="2" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.3"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            {/* Subtle glow for the arc */}
            <filter id="arcGlow">
              <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Background arc (subtle) */}
          <path
            d="M 30 130 A 100 100 0 0 1 230 130"
            fill="none"
            stroke="rgba(255, 255, 255, 0.03)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          
          {/* Main gradient arc with engineered gaps */}
          <path
            d="M 30 130 A 100 100 0 0 1 85 52"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="12"
            strokeLinecap="round"
            filter="url(#arcGlow)"
            opacity="0.9"
          />
          
          {/* White separator 1 */}
          <line
            x1="88"
            y1="50"
            x2="92"
            y2="48"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          
          <path
            d="M 95 46 A 100 100 0 0 1 165 46"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="12"
            strokeLinecap="round"
            filter="url(#arcGlow)"
            opacity="0.9"
          />
          
          {/* White separator 2 */}
          <line
            x1="168"
            y1="48"
            x2="172"
            y2="50"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          
          <path
            d="M 175 52 A 100 100 0 0 1 230 130"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="12"
            strokeLinecap="round"
            filter="url(#arcGlow)"
            opacity="0.9"
          />
          
          {/* Precision tick marks */}
          {[-45, -22.5, 0, 22.5, 45].map((tickAngle, i) => {
            const radians = (tickAngle - 90) * (Math.PI / 180);
            const innerRadius = 92;
            const outerRadius = 100;
            const x1 = 130 + Math.cos(radians) * innerRadius;
            const y1 = 130 + Math.sin(radians) * innerRadius;
            const x2 = 130 + Math.cos(radians) * outerRadius;
            const y2 = 130 + Math.sin(radians) * outerRadius;
            
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255, 255, 255, 0.15)"
                strokeWidth="1"
                strokeLinecap="round"
              />
            );
          })}
          
          {/* Razor-thin needle with shadow */}
          <motion.g
            initial={{ rotate: 0 }}
            animate={{ rotate: angle }}
            transition={{ 
              type: "tween",
              ease: [0.16, 1, 0.3, 1], // ease-out-cubic
              duration: 1.2
            }}
            style={{ transformOrigin: '130px 130px' }}
          >
            <line
              x1="130"
              y1="130"
              x2="130"
              y2="45"
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinecap="round"
              filter="url(#needleShadow)"
              opacity="0.95"
            />
          </motion.g>
          
          {/* Center hub */}
          <circle cx="130" cy="130" r="6" fill="rgba(255, 255, 255, 0.05)" />
          <circle cx="130" cy="130" r="3" fill="#ffffff" opacity="0.9" />
        </svg>
      </div>
      
      {/* Elegant Balance Display */}
      <div className="text-center mt-8 flex flex-col items-center justify-center w-full">
        <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">
          יתרה בטוחה לסוף החודש
        </p>
        <motion.p 
          key={adjustedBalance}
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-5xl md:text-6xl font-thin tracking-tight"
          style={{ 
            color: '#F1F5F9',
            direction: 'ltr',
            letterSpacing: '-0.03em'
          }}
        >
          ₪{adjustedBalance.toLocaleString('he-IL')}
        </motion.p>
        
        {/* Status with pulsing dot */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {isGreen && (
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: color }}
            />
          )}
          <span className="text-xs tracking-wide" style={{ color }}>
            {status}
          </span>
        </div>
        
        <div className="flex items-center justify-center gap-2 text-[9px] uppercase tracking-widest text-slate-600 mt-3">
          <span>מרווח בטיחות {Math.round(safetyBuffer * 100)}%</span>
        </div>
        
        {riskDay && (
          <p className="text-[10px] uppercase tracking-wider mt-4">
            <span className="text-slate-500">יום סיכון: </span>
            <span style={{ color }}>{riskDay}</span>
          </p>
        )}
      </div>
    </div>
  );
}