import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

export default function Disclaimer() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="mt-8 mb-4 border-t border-slate-800 pt-4">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-400 transition-colors mx-auto"
            >
                <AlertCircle className="w-3 h-3" />
                <span>כתב ויתור משפטי ופרטיות</span>
                {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="max-w-3xl mx-auto mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-800 text-[11px] text-slate-400 leading-relaxed text-center">
                            <p className="mb-2">
                                <strong className="text-slate-300">הבהרה משפטית:</strong> המידע המוצג במערכת זו הינו למטרות אינפורמטיביות בלבד ואינו מהווה ייעוץ פיננסי, משפטי או מיסויי. 
                                התחזיות מבוססות על אלגוריתמים סטטיסטיים ואין להסתמך עליהן באופן בלעדי לקבלת החלטות כלכליות. 
                                המערכת אינה אחראית לכל נזק או הפסד שייגרם כתוצאה משימוש במידע זה.
                            </p>
                            <p>
                                <strong className="text-slate-300">פרטיות ואבטחה:</strong> מערכת FlowUp פועלת בתצורת "Local-First". 
                                כל הנתונים הפיננסיים מעובדים ונשמרים באופן מקומי על גבי הדפדפן של המשתמש בלבד (באמצעות IndexedDB מוצפן). 
                                המערכת אינה שולחת, משתפת או שומרת את פרטי הבנק או העסקאות בשרתים חיצוניים.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}