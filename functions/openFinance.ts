import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Mock Data Generator for Open Finance Simulation
// Generates a month of transaction data representing a "Typical Orange/Green Customer"
// to demonstrate the Underwriting Engine capabilities.

const generateTransactions = () => {
    const today = new Date();
    const transactions = [];
    
    // Helper to add days
    const addDays = (date, days) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    };

    // 1. Income (Salary) - Green Factor
    transactions.push({
        date: new Date(today.getFullYear(), today.getMonth(), 1).toISOString(),
        description: "משכורת נטו - הייטק",
        amount: 18500,
        category: 'income'
    });

    // 2. Fixed Obligations (Red Layer - Future Cake)
    transactions.push({
        date: new Date(today.getFullYear(), today.getMonth(), 2).toISOString(),
        description: "שכר דירה תל אביב",
        amount: -6500, // High rent
        category: 'expense'
    });
    
    transactions.push({
        date: new Date(today.getFullYear(), today.getMonth(), 10).toISOString(),
        description: "הלוואה בנקאית",
        amount: -1200, 
        category: 'expense'
    });

    // 3. Lifestyle / Flexible (Orange Layer)
    // Multiple small transactions to simulate lifestyle fat
    const flexibleMerchants = [
        { desc: "Wolt - הזמנה", amount: -120 },
        { desc: "Netflix Subscription", amount: -49 },
        { desc: "Spotify Premium", amount: -20 },
        { desc: "מסעדה איטלקית", amount: -350 },
        { desc: "קניות זארה", amount: -450 },
        { desc: "סופר פארם", amount: -180 },
        { desc: "דלק מנטה", amount: -250 },
        { desc: "Apple Services", amount: -39.90 },
        { desc: "Wolt - הזמנה", amount: -85 },
        { desc: "AMPM", amount: -60 },
        { desc: "Cinema City", amount: -90 },
        { desc: "Bit העברה", amount: -200 }
    ];

    // Distribute them over the month
    for (let i = 0; i < flexibleMerchants.length; i++) {
        transactions.push({
            date: addDays(new Date(today.getFullYear(), today.getMonth(), 1), i * 2 + 3).toISOString(),
            description: flexibleMerchants[i].desc,
            amount: flexibleMerchants[i].amount,
            category: 'expense'
        });
    }

    // 4. Hidden Capital (AI Insight Potential)
    transactions.push({
        date: new Date(today.getFullYear(), today.getMonth(), 15).toISOString(),
        description: "ביטוח ישיר - חיוב כפול", // Duplicate charge for insight
        amount: -550,
        category: 'expense'
    });

    return transactions;
};

Deno.serve(async (req) => {
    try {
        // Just simulating a delay and returning data
        // No real API call for this mock
        
        const transactions = generateTransactions();
        
        // Calculate basic totals for the "Engine" simulation
        const totalIncome = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
        const currentBalance = totalIncome - totalExpenses; // Just for the month

        // Simulate "Future Cake" Analysis
        // Fixed: Rent (6500) + Loan (1200) = 7700
        // Flexible: Rest
        
        const engineData = {
            success: true,
            transactions: transactions,
            snapshot: {
                current_balance: currentBalance, // Mock opening balance + movement
                total_income: totalIncome,
                total_expenses: totalExpenses,
                projected_eom_balance: currentBalance * 1.1, // Optimistic projection
                risk_level: 'orange', // Insight-Driven Approval needed
                risk_day: null
            },
            // Pre-calculated analysis for the UI
            engineData: {
                riskStatus: 'orange', // TRAFFIC LIGHT MODEL
                projectedEOM: currentBalance * 1.1,
                totalIncome,
                totalExpenses,
                expenseAnalysis: {
                    fixed: 7700,
                    flex: totalExpenses - 7700,
                    taxPotential: 116 // From PDF example
                },
                smartInsights: [
                    {
                        type: 'optimization',
                        title: 'זיהוי הון חבוי',
                        message: 'אותר חיוב כפול ב"ביטוח ישיר" (550 ₪). ביטולו יגדיל את הפנוי החודשי.',
                        icon: 'Eye'
                    },
                    {
                        type: 'lifestyle_pivot',
                        title: 'אופטימיזציה ללייף-סטייל',
                        message: 'צמצום 20% מהוצאות Wolt ומסעדות יעביר את הלקוח למסלול ירוק.',
                        icon: 'Zap'
                    }
                ]
            }
        };

        return Response.json({ data: engineData });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});