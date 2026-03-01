import { ChevronDown, ChevronUp, AlertTriangle, BrainCircuit, Activity, FileText } from 'lucide-react';

export default function InsightsAgent({ analysis, isLoading }) {
    const [isOpen, setIsOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            setIsOpen(!mobile);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // ✅ Loading state אמיתי
    if (isLoading) {
        return (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-white font-medium">האנליסט מעבד נתונים...</h3>
                <p className="text-slate-500 text-sm mt-1">
                    מנתח יכולת החזר והתחייבויות קשיחות.
                </p>
            </div>
        );
    }

    // ✅ Empty / Error state
    if (!analysis || analysis.error) {
        return (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                    <AlertTriangle className="w-6 h-6 text-slate-500" />
                </div>
                <h3 className="text-white font-medium">אין מספיק נתונים לניתוח</h3>
                <p className="text-slate-500 text-sm mt-1">
                    לא נמצאו מספיק תנועות שניתן לנתח בשלב זה.
                </p>
            </div>
        );
    }

    return (
        <div className="relative h-full">
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-indigo-500/20 rounded-xl overflow-hidden shadow-lg shadow-indigo-900/5 h-full flex flex-col">

                {/* Header */}
                <div
                    className={`px-4 py-3 border-b border-slate-800/60 bg-slate-900/50 flex justify-between items-center ${isMobile ? 'cursor-pointer hover:bg-slate-800' : ''}`}
                    onClick={() => isMobile && setIsOpen(!isOpen)}
                >
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <div className="absolute inset-0 bg-indigo-500 blur-sm opacity-20 animate-pulse rounded-full" />
                            <BrainCircuit className="w-5 h-5 text-indigo-400 relative z-10" />
                        </div>
                        <span className="text-sm font-semibold text-slate-200">
                            FlowUp AI Analyst
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/30 px-2 py-0.5 rounded-full border border-indigo-900/30">
                            DTI: {analysis.metrics?.structural_dti ?? 0}%
                        </span>
                        {isMobile && (
                            isOpen
                                ? <ChevronUp className="w-4 h-4 text-slate-400" />
                                : <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                    </div>
                </div>

                {/* Body */}
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={isMobile ? { height: 0, opacity: 0 } : false}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={isMobile ? { height: 0, opacity: 0 } : false}
                            className="overflow-hidden flex-1 flex flex-col"
                        >
                            <div className="p-4 flex-1 flex flex-col space-y-4 overflow-y-auto max-h-[400px]">

                                {/* Metrics */}
                                <div className="grid grid-cols-2 gap-2">
                                    <MetricBox label="Structural DTI" value={`${analysis.metrics?.structural_dti ?? 0}%`} />
                                    <MetricBox label="Adjusted DTI" value={`${analysis.metrics?.adjusted_dti ?? 0}%`} color="text-emerald-400" />
                                    <MetricBox label="Liquidity Buffer" value={`${analysis.metrics?.liquidity_buffer_months ?? 0} mo`} />
                                    <MetricBox label="Income Volatility" value={analysis.metrics?.income_volatility ?? 0} color="text-amber-400" />
                                </div>

                                {/* Risk Tier */}
                                <Section title="Risk Tier">
                                    <span className={
                                        analysis.risk_tier === 'Red'
                                            ? 'text-red-400'
                                            : analysis.risk_tier === 'Orange'
                                                ? 'text-orange-400'
                                                : 'text-emerald-400'
                                    }>
                                        {analysis.risk_tier || 'Unknown'}
                                    </span>
                                </Section>

                                <CommentBox title="Structural DTI" text={analysis.structural_dti_commentary} />
                                <CommentBox title="Flexibility Margin" text={analysis.behavioral_flexibility_margin} />
                                <CommentBox title="Liquidity Cushion" text={analysis.liquidity_cushion_assessment} />

                                <Section title="Approval Rationale">
                                    {analysis.approval_rationale}
                                </Section>

                                <div className="bg-indigo-900/20 p-3 rounded-lg border border-indigo-500/20">
                                    <p className="text-[10px] text-indigo-300 uppercase tracking-wider mb-1">
                                        Recommended Structure
                                    </p>
                                    <p className="text-sm text-indigo-100 font-medium">
                                        {analysis.recommended_loan_structure || "Standard"}
                                    </p>
                                </div>

                                {analysis.risk_flags?.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertTriangle className="w-4 h-4 text-red-400" />
                                            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                                                Risk Flags
                                            </h4>
                                        </div>
                                        <ul className="space-y-1.5">
                                            {analysis.risk_flags.map((flag, idx) => (
                                                <li key={idx} className="text-xs text-red-200/80 bg-red-950/20 px-2 py-1.5 rounded">
                                                    {flag}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
}

/* ---------- Small UI Helpers ---------- */

function MetricBox({ label, value, color = "text-white" }) {
    return (
        <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/50">
            <p className="text-[10px] text-slate-500 mb-0.5">{label}</p>
            <p className={`text-sm font-mono ${color}`}>{value}</p>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
            <p className="text-[10px] text-slate-500 uppercase mb-1">{title}</p>
            <p className="text-sm text-slate-300 leading-relaxed">{children}</p>
        </div>
    );
}

function CommentBox({ title, text }) {
    return (
        <Section title={title}>
            {text || "N/A"}
        </Section>
    );
}