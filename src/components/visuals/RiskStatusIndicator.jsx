import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

export default function RiskStatusIndicator({ status }) {
  const statusConfig = {
    green: {
      color: 'bg-green-500',
      textColor: 'text-green-700',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      icon: CheckCircle,
      label: 'בטוח',
      description: 'המצב הפיננסי שלך יציב'
    },
    yellow: {
      color: 'bg-yellow-500',
      textColor: 'text-yellow-700',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      icon: AlertTriangle,
      label: 'אזהרה',
      description: 'יתרה נמוכה - שימו לב'
    },
    red: {
      color: 'bg-red-500',
      textColor: 'text-red-700',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      icon: AlertCircle,
      label: 'סיכון גבוה',
      description: 'יתרה צפויה שלילית!'
    }
  };

  const config = statusConfig[status] || statusConfig.green;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`p-6 rounded-2xl border-2 ${config.borderColor} ${config.bgColor}`}
      dir="rtl"
    >
      <div className="flex items-center gap-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className={`w-20 h-20 rounded-full ${config.color} flex items-center justify-center shadow-lg`}
        >
          <Icon className="w-10 h-10 text-white" strokeWidth={2.5} />
        </motion.div>
        <div className="flex-1">
          <h3 className={`text-2xl font-bold ${config.textColor} mb-1`}>
            {config.label}
          </h3>
          <p className="text-slate-600 text-sm">
            {config.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}