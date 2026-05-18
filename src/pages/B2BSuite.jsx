import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Briefcase, FileText, Droplets, Cpu, PhoneCall, ArrowRight, ScanLine, Banknote } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

import FactoringTab from '../components/b2b/FactoringTab';
import WorkingCapitalTab from '../components/b2b/WorkingCapitalTab';
import UnderwritingInfraTab from '../components/b2b/UnderwritingInfraTab';
import CollectionsTab from '../components/b2b/CollectionsTab';
import CheckDiscountTab from '../components/b2b/CheckDiscountTab';
import B2BFinancingTab from '../components/b2b/B2BFinancingTab';

const TABS = [
    { id: 'check_discount', label: 'ניכיון צ׳קים', icon: ScanLine, Component: CheckDiscountTab },
    { id: 'financing', label: 'מימון עסקי', icon: Banknote, Component: B2BFinancingTab },
    { id: 'working_capital', label: 'הון חוזר', icon: Droplets, Component: WorkingCapitalTab },
    { id: 'factoring', label: 'ניכיון חשבוניות', icon: FileText, Component: FactoringTab },
    { id: 'underwriting', label: 'תשתית חיתום', icon: Cpu, Component: UnderwritingInfraTab },
    { id: 'collections', label: 'גבייה חכמה', icon: PhoneCall, Component: CollectionsTab }
];

export default function B2BSuite() {
    const [active, setActive] = useState('check_discount');

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" dir="rtl">
            <div className="fixed inset-0 opacity-30 pointer-events-none">
                <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, rgba(34, 211, 238, 0.15) 1px, transparent 0)`,
                    backgroundSize: '40px 40px'
                }} />
            </div>

            <header className="relative z-10 px-4 py-4 md:px-10 md:py-8">
                <div className="max-w-7xl mx-auto flex items-center justify-between border-b border-slate-800/60 pb-3 md:pb-6 flex-wrap gap-3">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
                            <Briefcase className="w-4 h-4 md:w-5 md:h-5 text-cyan-300" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg md:text-2xl font-bold text-white">B2B Suite</h1>
                            <p className="hidden md:block text-slate-500 text-xs mt-1 tracking-[0.18em] uppercase">
                                אשראי עסקי · Open Finance · Workflow Automation
                            </p>
                        </div>
                    </div>
                    <Button asChild variant="outline" size="sm" className="bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white h-8 px-3 text-[11px]">
                        <Link to="/Dashboard">
                            חזרה לדשבורד
                            <ArrowRight className="w-3 h-3 mr-1" />
                        </Link>
                    </Button>
                </div>
            </header>

            <main className="relative z-10 px-4 pb-8 md:px-10 md:pb-12">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto">
                    <Tabs value={active} onValueChange={setActive} dir="rtl">
                        <TabsList className="bg-slate-900/60 border border-slate-800 backdrop-blur-sm p-1 h-auto flex gap-1 mb-4 md:mb-6 overflow-x-auto flex-nowrap md:flex-wrap scrollbar-none">
                            {TABS.map(({ id, label, icon: Icon }) => (
                                <TabsTrigger
                                    key={id}
                                    value={id}
                                    className="text-[11px] md:text-xs gap-1.5 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-200 text-slate-400 whitespace-nowrap shrink-0"
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {label}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        {TABS.map(({ id, Component }) => (
                            <TabsContent key={id} value={id} className="mt-0">
                                <Component />
                            </TabsContent>
                        ))}
                    </Tabs>
                </motion.div>
            </main>
        </div>
    );
}