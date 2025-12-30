import React from 'react';
import { motion } from 'framer-motion';

export default function WhatIfSimulator({ value, onChange }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="relative p-6 rounded-2xl"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(20px)'
      }}
      dir="rtl"
    >
      <h3 className="text-sm font-semibold text-slate-300 mb-4">
        סימולטור "מה אם"
      </h3>
      <p className="text-xs text-slate-400 mb-4">
        בדוק את ההשפעה של הוצאה עתידית על המצב הפיננסי שלך
      </p>

      <div className="relative">
        <input
          type="number"
          placeholder="הזן סכום הוצאה..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-white text-3xl font-bold py-3 px-4 outline-none"
          style={{
            borderBottom: '2px solid rgba(255, 255, 255, 0.15)',
            transition: 'border-color 0.3s'
          }}
          onFocus={(e) => e.target.style.borderBottomColor = '#00D994'}
          onBlur={(e) => e.target.style.borderBottomColor = 'rgba(255, 255, 255, 0.15)'}
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-2xl font-bold">
          ₪
        </span>
      </div>

      {parseFloat(value) > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 p-3 rounded-lg"
          style={{
            background: 'rgba(0, 217, 148, 0.1)',
            border: '1px solid rgba(0, 217, 148, 0.2)'
          }}
        >
          <p className="text-xs text-slate-300">
            ✓ הסימולציה פעילה - המחוון מעודכן בזמן אמת
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}