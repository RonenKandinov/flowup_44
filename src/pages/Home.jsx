import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import OpenFinanceConnect from '../components/connect/OpenFinanceConnect';
import { motion } from 'framer-motion';
import { Shield, Zap, LineChart, Lock, ArrowLeft } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();

  // Check if we are returning from bank consent
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('of_callback')) {
      navigate(createPageUrl('Dashboard') + location.search);
    }
  }, [location, navigate]);

  // Check if user already has an active connection
  const { data: user } = useQuery({
    queryKey: ['user-home'],
    queryFn: async () => {
      try {
        return await base44.auth.me();
      } catch (e) {
        return null;
      }
    },
    retry: false
  });

  const { data: activeConnection } = useQuery({
    queryKey: ['active-connection-home', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
        const conns = await base44.entities.OpenFinanceConnection.filter({ psu_id: user.id, status: 'ACTIVE' }, '-created_date', 1);
        return conns[0] || null;
    }
  });

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      {/* Background pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(34, 211, 238, 0.15) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        
        {/* Right Side: Hero Text */}
        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="text-right space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-2">
            <Zap className="w-4 h-4" />
            <span>הדור הבא של חיתום אשראי</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight tracking-tight">
            FlowUp <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
              FutureFlow
            </span>
          </h1>
          
          <p className="text-lg text-slate-400 max-w-lg leading-relaxed">
            מערכת חיתום חכמה המנתחת את נתוני הבנק שלך בזמן אמת ומספקת תמונת מצב פיננסית מדויקת, תחזיות תזרים והמלצות מותאמות אישית.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-white font-medium text-base">חיבור מאובטח</h3>
                <p className="text-slate-500 text-sm mt-1">קריאה בלבד, ללא אפשרות לביצוע פעולות בחשבון</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
                <LineChart className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-white font-medium text-base">ניתוח AI מתקדם</h3>
                <p className="text-slate-500 text-sm mt-1">זיהוי מגמות וחיזוי תזרים מזומנים עתידי</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Left Side: Connection Component */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md mx-auto lg:mx-0 lg:mr-auto"
        >
          <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-2xl shadow-blue-900/20 overflow-hidden">
            
            {activeConnection ? (
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
                  <Shield className="w-10 h-10 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">החשבון מחובר</h2>
                <p className="text-slate-400 mb-8">
                  זיהינו חיבור פעיל למערכת. הנתונים שלך מסונכרנים ומאובטחים.
                </p>
                <Button 
                  onClick={() => navigate(createPageUrl('Dashboard'))}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white h-14 rounded-xl text-lg font-medium shadow-lg shadow-blue-900/20"
                >
                  <span>מעבר לדאשבורד</span>
                  <ArrowLeft className="w-5 h-5 mr-2" />
                </Button>
              </div>
            ) : (
              <>
                <OpenFinanceConnect inline={true} onConnected={() => navigate(createPageUrl('Dashboard'))} />
                <div className="pb-6 px-6 flex items-center justify-center gap-2 text-xs text-slate-500 bg-slate-900/50">
                  <Lock className="w-3.5 h-3.5" />
                  <span>הנתונים שלך מוצפנים ונשמרים בפרטיות מלאה</span>
                </div>
              </>
            )}

          </div>
        </motion.div>

      </div>
    </div>
  );
}