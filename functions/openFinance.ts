import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ==========================================
// PROTOCOL CORE (Server-Side Port)
// ==========================================

// 1. Mapping Table
const CATEGORY_MAPPING = {
    SALARY: { id: 1100, name: 'salary', displayName: 'משכורת', shadowType: 'DEF', element: 'LIGHT', monster: 'Blue-Eyes White Dragon' },
    BONUS_INCOME: { id: 1200, name: 'bonus', displayName: 'בונוס', shadowType: 'DEF', element: 'DARK', monster: 'Dark Magician' },
    RENT_MORTGAGE: { id: 2100, name: 'rent_mortgage', displayName: 'שכירות/משכנתא', shadowType: 'ATK', element: 'EARTH', monster: 'Gaia The Fierce Knight' },
    GROCERIES: { id: 2200, name: 'groceries', displayName: 'קניות בסופר', shadowType: 'ATK', element: 'EARTH', monster: 'Celtic Guardian' },
    UTILITIES: { id: 2300, name: 'utilities', displayName: 'חשבונות', shadowType: 'TRAP', element: 'LIGHT', monster: 'Swords of Revealing Light' },
    ENTERTAINMENT: { id: 2400, name: 'entertainment', displayName: 'בידור ופנאי', shadowType: 'ATK', element: 'WIND', monster: 'Mystical Elf' },
    TRANSPORT: { id: 2500, name: 'transport', displayName: 'תחבורה', shadowType: 'ATK', element: 'WIND', monster: 'Winged Dragon, Guardian of the Fortress' },
    SUBSCRIPTIONS_DUPE: { id: 2600, name: 'subscriptions_dupe', displayName: 'מנויים כפולים', shadowType: 'ATK', element: 'DARK', monster: 'Man-Eater Bug' },
    SAVINGS: { id: 3100, name: 'savings', displayName: 'חיסכון', shadowType: 'SPELL', element: 'LIGHT', monster: 'Pot of Greed' },
    LONG_TERM_REAL_ESTATE: { id: 3200, name: 'long_term_real_estate', displayName: 'השקעת נדל"ן (טווח ארוך)', shadowType: 'DEF', element: 'EARTH', monster: 'Green-Eyes White Dragon' },
    INVESTMENTS_HIGH_RISK: { id: 3300, name: 'investments_high_risk', displayName: 'השקעות בסיכון גבוה', shadowType: 'SPELL', element: 'DARK', monster: 'Exodia The Forbidden One' },
    UNKNOWN: { id: 9999, name: 'unknown', displayName: 'לא מזוהה', shadowType: 'NEUTRAL', element: 'NEUTRAL', monster: 'Kuriboh' }
};

// 2. Seal of Orichalcos
class SealOfOrichalcos {
    static seal(magnitude, phantom, timestamp) {
        if (magnitude === undefined || phantom === undefined || !timestamp) throw new Error("Seal of Orichalcos: Incomplete data.");
        const payload = `${magnitude.toFixed(4)}|${phantom.toFixed(4)}|${timestamp}|SEAL_OF_ORICHALCOS`;
        let hash = 5381;
        for (let i = 0; i < payload.length; i++) hash = ((hash << 5) + hash) + payload.charCodeAt(i);
        return (hash >>> 0).toString(16).toUpperCase();
    }
}

// 3. Shadow Mapper
function hash(val) {
    let str = String(val);
    let h = 0;
    for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    return h.toString(16);
}

const PRECISION_SCALE = 1000;
const ENTROPY_FACTOR = 1000000;

class ShadowMapper {
    static toShadow(data, userKeyFactor) {
        if (!userKeyFactor) throw new Error("Millennium Protocol: Invalid UserKeyFactor.");
        const normalizedAmount = data.amount / PRECISION_SCALE;
        const theta = (userKeyFactor * ENTROPY_FACTOR) % (2 * Math.PI);
        const magnitude = normalizedAmount * Math.cos(theta);
        const phantom = normalizedAmount * Math.sin(theta);
        return { magnitude, phantom, angle_hash: hash(theta), date: data.date };
    }
}

// 4. Fiscal Agent (Server-Side Logic)
const FiscalAgent = {
    /**
     * Seals a transaction using the Millennium Protocol.
     * Maps raw data to "Monster Cards" and creates a ShadowRealmEntry.
     */
    processTransaction: (transaction, masterKey) => {
        if (!masterKey) throw new Error("FiscalAgent: Master Key required for server-side processing");

        let mapping = CATEGORY_MAPPING.UNKNOWN;
        if (transaction.amount > 0) {
            mapping = transaction.description.includes('משכורת') ? CATEGORY_MAPPING.SALARY : CATEGORY_MAPPING.BONUS_INCOME;
        } else {
            const desc = transaction.description.toLowerCase();
            if (desc.includes('שכר דירה') || desc.includes('משכנתא')) mapping = CATEGORY_MAPPING.RENT_MORTGAGE;
            else if (desc.includes('סופר') || desc.includes('מזון')) mapping = CATEGORY_MAPPING.GROCERIES;
            else if (desc.includes('חשמל') || desc.includes('מים') || desc.includes('ארנונה')) mapping = CATEGORY_MAPPING.UTILITIES;
            else if (desc.includes('ביט') || desc.includes('העברה')) mapping = CATEGORY_MAPPING.TRANSPORT;
            else if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('apple')) mapping = CATEGORY_MAPPING.ENTERTAINMENT; 
            else mapping = CATEGORY_MAPPING.ENTERTAINMENT;
        }

        if (transaction.description.includes('חיוב כפול')) mapping = CATEGORY_MAPPING.SUBSCRIPTIONS_DUPE;

        const shadowVector = ShadowMapper.toShadow({
            amount: Math.abs(transaction.amount),
            date: transaction.date,
            type: transaction.amount > 0 ? 'income' : 'expense'
        }, masterKey);

        const sealHash = SealOfOrichalcos.seal(shadowVector.magnitude, shadowVector.phantom, shadowVector.date);

        return {
            magnitude: shadowVector.magnitude,
            phantom: shadowVector.phantom,
            transaction_date: shadowVector.date,
            monster_card_name: mapping.monster,
            element: mapping.element,
            shadow_type: transaction.amount > 0 ? 'DEF' : 'ATK',
            integrity_hash: sealHash,
            is_corrupted: false,
            description: "Sealed Content"
        };
    },

    /**
     * THE UNDERWRITING ENGINE (Traffic Light System)
     * Calculates Risk Score, DTI, and verifies Asset Shields.
     */
    analyzeRisk: (income, fixedExpenses, flexibleExpenses, assets, loanAmount) => {
        // 1. Defaults
        const proposedLoan = loanAmount || 50000;
        const proposedMonthlyRepayment = proposedLoan / 60; // 5 Year Term Assumption
        
        // 2. DTI Calculation
        const totalDebt = fixedExpenses + proposedMonthlyRepayment; 
        const dti = totalDebt / (income || 1); // Avoid div/0

        // 3. Asset Shield (Liquidity Runway)
        const totalLiquidAssets = (assets.cash || 0) + (assets.etf || 0) + (assets.trainingFund || 0);
        const runwayMonths = totalLiquidAssets / proposedMonthlyRepayment;

        // 4. Traffic Light Logic (Aggressive Underwriting)
        let status = 'RED';
        let score = 50;
        let shieldActive = false;

        // GREEN: Fast Track
        if (dti <= 0.40) {
            status = 'GREEN';
            score = 85 + (runwayMonths > 12 ? 10 : 0);
        } 
        // ORANGE: The Analyst Zone (40% - 60%)
        else if (dti <= 0.60) {
            status = 'ORANGE'; 
            score = 65;
            
            if (runwayMonths >= 12) {
                score += 15; 
                shieldActive = true;
            }
        } 
        // RED: High Risk (> 60%)
        else {
            status = 'RED';
            score = 30;
            // Asset Override: Force Red -> Orange if Runway >= 24 months
            if (runwayMonths >= 24) {
                status = 'ORANGE';
                score = 60;
                shieldActive = true;
            }
        }

        // 5. Lifestyle Pivot Simulation (Target DTI = 0.40)
        const targetDTI = 0.40;
        const maxAllowedDebt = income * targetDTI;
        const requiredCut = Math.max(0, totalDebt - maxAllowedDebt);
        const pivotPossible = requiredCut < flexibleExpenses;

        return {
            status,
            score: Math.min(100, Math.round(score)),
            dti: {
                current: parseFloat(dti.toFixed(2)),
                projected: parseFloat(targetDTI)
            },
            assets: {
                total_liquid: totalLiquidAssets,
                breakdown: { 
                    cash: assets.cash, 
                    etf: assets.etf, 
                    training_fund: assets.trainingFund 
                }
            },
            analystShield: {
                headline: status === 'GREEN' ? "עסקה מאושרת - יחס החזר תקין" : (shieldActive ? "אישור חריג - גיבוי נכסים (Asset Shield)" : "נדרשת בחינה - יחס החזר גבוה"),
                justification: `DTI נוכחי: ${(dti * 100).toFixed(1)}%. ${shieldActive ? `אושר בזכות כרית נזילות של ${Math.round(runwayMonths)} חודשים (סף דרוש: 12).` : ''}`,
                runwayMonths: Math.round(runwayMonths),
                lifestylePivot: pivotPossible 
                    ? `צמצום ${(requiredCut / flexibleExpenses * 100).toFixed(0)}% מהוצאות פנאי יחזיר את הלקוח ל-Green Zone.`
                    : "אין גמישות מספקת בהוצאות שוטפות."
            }
        };
    }
};

// ==========================================
// OPEN FINANCE INTEGRATION & ENGINE API
// ==========================================
const OPEN_FINANCE_BASE_URL = "https://sandbox-api.openfinance.io";

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Parse Body: allow loanAmount override for simulation
        let body = {};
        try { body = await req.json(); } catch {}
        const { masterKey, loanAmount } = body;

        // 1. Secrets & Auth
        const apiKey = Deno.env.get("OPEN_FINANCE_API_KEY");
        const apiSecret = Deno.env.get("OPEN_FINANCE_API_SECRET");

        let accessToken = null;
        if (apiKey && apiSecret) {
            try {
                // Mock OAuth Call to demonstrate structure
                // In real implementation: fetch token from OPEN_FINANCE_BASE_URL
                accessToken = "mock_access_token_" + Date.now();
                console.log("✅ Authenticated with Open Finance");
            } catch (e) {
                console.error("Auth Error:", e);
            }
        }

        // 2. Data Fetching (Mocked for Demo Scenario)
        // We construct a specific financial profile to trigger the "ORANGE" logic
        const today = new Date();
        const rawTransactions = [
            // Income
            { date: new Date(today.getFullYear(), today.getMonth(), 1).toISOString(), description: "משכורת נטו - הייטק", amount: 18500 },
            // Fixed Expenses (Debt)
            { date: new Date(today.getFullYear(), today.getMonth(), 2).toISOString(), description: "שכר דירה תל אביב", amount: -6500 },
            { date: new Date(today.getFullYear(), today.getMonth(), 10).toISOString(), description: "הלוואה בנקאית", amount: -1200 },
            // Flexible Expenses (Lifestyle)
            { date: new Date(today.getFullYear(), today.getMonth(), 5).toISOString(), description: "Wolt - הזמנה", amount: -120 },
            { date: new Date(today.getFullYear(), today.getMonth(), 7).toISOString(), description: "Wolt - הזמנה", amount: -150 },
            { date: new Date(today.getFullYear(), today.getMonth(), 12).toISOString(), description: "Zara Shopping", amount: -450 },
            { date: new Date(today.getFullYear(), today.getMonth(), 15).toISOString(), description: "ביטוח ישיר - חיוב כפול", amount: -550 }, // Anomaly
            { date: new Date(today.getFullYear(), today.getMonth(), 20).toISOString(), description: "Netflix", amount: -60 },
            { date: new Date(today.getFullYear(), today.getMonth(), 22).toISOString(), description: "Spotify", amount: -40 },
        ];

        // 3. Process & Aggregate Data
        let totalIncome = 0;
        let fixedExpenses = 0;
        let flexibleExpenses = 0;

        // Seal transactions and calculate totals simultaneously
        const sealedTransactions = rawTransactions.map(tx => {
            if (tx.amount > 0) totalIncome += tx.amount;
            else {
                // Simple heuristic for classification
                const desc = tx.description;
                if (desc.includes('שכר דירה') || desc.includes('הלוואה') || desc.includes('ביטוח')) {
                    fixedExpenses += Math.abs(tx.amount);
                } else {
                    flexibleExpenses += Math.abs(tx.amount);
                }
            }
            return FiscalAgent.processTransaction(tx, masterKey || 1.618);
        });

        const currentBalance = totalIncome - (fixedExpenses + flexibleExpenses);

        // 4. Retrieve Assets (Mocked from Open Finance "Accounts" Endpoint)
        // Scenario: User has significant assets to justify the risk
        const assets = {
            cash: currentBalance + 12000, // Current balance + some buffer
            etf: 45000,
            trainingFund: 120000 
        };

        // 5. RUN THE UNDERWRITING ENGINE
        const riskAnalysis = FiscalAgent.analyzeRisk(
            totalIncome,
            fixedExpenses,
            flexibleExpenses,
            assets,
            loanAmount // Passed from frontend or default 50k
        );

        // 6. Persistence (Shadow Realm)
        try {
            if (sealedTransactions.length > 0) {
                 await base44.asServiceRole.entities.ShadowRealmEntry.bulkCreate(sealedTransactions);
            }
        } catch (dbError) {
            console.error("DB Persistence Warning:", dbError.message);
        }

        // 7. Construct Final Response
        // Merging the risk analysis into the engineData structure expected by frontend
        const engineData = {
            success: true,
            isSynced: true,
            transactions: sealedTransactions,
            
            // The Dashboard UI components map to these fields:
            snapshot: {
                current_balance: currentBalance,
                total_income: totalIncome,
                total_expenses: fixedExpenses + flexibleExpenses,
                projected_eom_balance: currentBalance * 1.1,
                risk_level: riskAnalysis.status.toLowerCase(), // green/orange/red
            },
            
            // The new "Brain" output
            engineData: {
                ...riskAnalysis, // Injects status, score, dti, assets, analystShield
                
                riskStatus: riskAnalysis.status.toLowerCase(),
                projectedEOM: currentBalance * 1.1,
                totalIncome,
                totalExpenses: fixedExpenses + flexibleExpenses,
                expenseAnalysis: {
                    fixed: fixedExpenses,
                    flex: flexibleExpenses,
                    taxPotential: 116
                },
                smartInsights: [
                    // Main Conclusion (The "Brain")
                    { 
                        type: 'strategic_brain', 
                        title: riskAnalysis.analystShield.headline, 
                        message: riskAnalysis.analystShield.justification + ' ' + (riskAnalysis.status === 'ORANGE' ? riskAnalysis.analystShield.lifestylePivot : ''),
                        icon: 'ShieldCheck' 
                    },
                    { type: 'optimization', title: 'זיהוי הון חבוי', message: 'אותר חיוב כפול ב"ביטוח ישיר" (550 ₪).', icon: 'Eye' }
                ]
            }
        };

        return Response.json({ data: engineData });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});