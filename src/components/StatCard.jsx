import React from 'react';
import { motion } from 'framer-motion';

const colorStyles = {
    green: {
        border: 'border-emerald-500/20',
        bg: 'bg-emerald-500/5',
        text: 'text-emerald-400',
        glow: 'shadow-emerald-500/10'
    },
    red: {
        border: 'border-red-500/20',
        bg: 'bg-red-500/5',
        text: 'text-red-400',
        glow: 'shadow-red-500/10'
    },
    blue: {
        border: 'border-cyan-500/20',
        bg: 'bg-cyan-500/5',
        text: 'text-cyan-400',
        glow: 'shadow-cyan-500/10'
    }
};

export default function StatCard({ title, value, icon: Icon, color = 'blue', delay = 0 }) {
    const styles = colorStyles[color] || colorStyles.blue;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.5 }}
            className={`
                relative overflow-hidden rounded-xl border ${styles.border} ${styles.bg} 
                p-4 shadow-lg ${styles.glow} backdrop-blur-sm
            `}
        >
            <div className="relative z-10 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">
                        {title}
                    </span>
                    {Icon && <Icon className={`w-4 h-4 ${styles.text} opacity-80`} />}
                </div>
                
                <div className="flex items-baseline gap-1">
                    <h3 className="text-2xl font-bold text-white font-mono tracking-tight">
                        {value}
                    </h3>
                </div>
            </div>

            {/* Background Decoration */}
            <div className={`
                absolute -right-4 -bottom-4 w-20 h-20 rounded-full 
                ${styles.bg} opacity-50 blur-2xl pointer-events-none
            `} />
        </motion.div>
    );
}