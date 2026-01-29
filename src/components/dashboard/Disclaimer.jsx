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
            <div className="p-4 text-xs text-slate-500 space-y-3 bg-slate-800/20 rounded-b-lg border-x border-b border-slate-700/50">
              <p>
                <strong className="text-slate-400 block mb-1">הבהרה משפטית:</strong>
                המערכת הנה כלי עזר ויזואלי לסימולציה וניתוח נתונים בלבד, ואינה מהווה ייעוץ פיננסי, השקעותי או פנסיוני לפי חוק. התחזיות מבוססות על מודלים סטטיסטיים ואין לראות בהן הבטחה לביצועים עתידיים. האחריות על כל החלטה פיננסית הנה על המשתמש בלבד. המערכת פועלת במודל "קריאה בלבד" (Read-only) ואינה מבצעת פעולות בחשבון הבנק.
              </p>
              <p>
                <strong className="text-slate-400 block mb-1">פרטיות ואבטחה:</strong>
                הנתונים מעובדים במחשב שלך בלבד (Local-First) ואינם נשמרים בשרתי המערכת. אנו משתמשים ב-PII Sanitizer לניקוי פרטים מזהים לפני הניתוח.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}