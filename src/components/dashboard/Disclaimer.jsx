import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

export default function Disclaimer() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-8 mx-4"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 text-slate-400 hover:text-slate-300 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-xs">הצהרת אחריות משפטית</span>
        </div>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 text-xs text-slate-500 space-y-2 bg-slate-800/20 rounded-b-lg border-x border-b border-slate-700/50">
              <p>
                <strong className="text-slate-400">אין ייעוץ פיננסי:</strong> כל התחזיות, תאריכי הסיכון ומצבי ה"מד מהירות" מוצגים למטרות מידע בלבד ואינם מהווים ייעוץ פיננסי או המלצה לפעולה כלשהי.
              </p>
              <p>
                <strong className="text-slate-400">שגיאה סטטיסטית:</strong> התחזיות מבוססות על מודלים סטטיסטיים ודפוסי הוצאה היסטוריים. ההתנהגות העתידית עשויה לחרוג מהתחזיות והדיוק אינו מובטח.
              </p>
              <p>
                <strong className="text-slate-400">תקינות נתונים:</strong> הדיוק של לוח המחוונים תלוי לחלוטין בתקינות קובץ ה-CSV שסופק. FlowUp אינה אחראית לשגיאות הנובעות מקבצים חלקיים או שעברו שינוי.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}