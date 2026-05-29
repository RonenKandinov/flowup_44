import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// FutureCake data builder.
// Two modes:
//   1. Explicit mode — caller passes fixedExpenses/flexExpenses (used by what-if sims).
//   2. Intelligence mode — when no explicit values are passed, we pull the user's
//      real cash-flow profile via cashFlowIntelligence and slice discretionary
//      into easy/medium/hard tiers (per README → real repayment capacity story).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    let fixedExpenses = payload?.fixedExpenses;
    let flexExpenses = payload?.flexExpenses;
    const taxRefundPotential = payload?.taxRefundPotential;
    let discretionaryBreakdown = null;
    let sourceProfile = null;

    const explicit = fixedExpenses != null || flexExpenses != null;

    // Intelligence mode: derive from cashFlowIntelligence
    if (!explicit) {
      try {
        const cfRes = await base44.functions.invoke('cashFlowIntelligence', {});
        const profile = cfRes?.data?.cashFlowProfile;
        if (profile?.expenses) {
          fixedExpenses = profile.expenses.fixed || 0;
          flexExpenses = profile.expenses.discretionary || 0;
          discretionaryBreakdown = profile.expenses.discretionaryBreakdown || null;
          sourceProfile = {
            recurringTransactions: profile.recurringTransactions,
            cashFlowTrustScore: profile.cashFlowTrustScore,
            realRepaymentCapacity: profile.realRepaymentCapacity
          };
        }
      } catch (_) {
        // fall through to preview mode
      }
    }

    const safeFixed = Number(fixedExpenses) || 0;
    const safeFlex = Number(flexExpenses) || 0;
    const safeTax = Number(taxRefundPotential) || 0;
    const isPreviewMode = safeFixed === 0 && safeFlex === 0;
    const baseTotal = safeFixed + safeFlex;

    let chartData;
    if (isPreviewMode) {
      chartData = [
        { name: 'החזרי חובות קבועים', value: 6000, color: '#ec4899', type: 'fixed' },
        { name: 'הוצאות מחיה משתנות', value: 4000, color: '#14b8a6', type: 'flex' }
      ];
    } else {
      chartData = [
        { name: 'החזרי חובות קבועים', value: safeFixed, color: '#ec4899', type: 'fixed' }
      ];
      // If we have a tiered breakdown from cashFlowIntelligence, render 3 slices
      // so the user can see WHICH spending is realistically cuttable.
      if (discretionaryBreakdown && (discretionaryBreakdown.easy || discretionaryBreakdown.medium || discretionaryBreakdown.hard)) {
        if (discretionaryBreakdown.easy > 0) {
          chartData.push({ name: 'הוצאות גמישות (קל לקצץ)', value: discretionaryBreakdown.easy, color: '#22d3ee', type: 'flex_easy' });
        }
        if (discretionaryBreakdown.medium > 0) {
          chartData.push({ name: 'הוצאות גמישות (בינוני)', value: discretionaryBreakdown.medium, color: '#14b8a6', type: 'flex_medium' });
        }
        if (discretionaryBreakdown.hard > 0) {
          chartData.push({ name: 'הוצאות הכרחיות (קשה לקצץ)', value: discretionaryBreakdown.hard, color: '#0ea5e9', type: 'flex_hard' });
        }
      } else {
        chartData.push({ name: 'הוצאות מחיה משתנות', value: safeFlex, color: '#14b8a6', type: 'flex' });
      }
    }

    if (!isPreviewMode && safeTax > 0) {
      chartData.push({
        name: 'החזרי מס (פוטנציאל)',
        value: safeTax,
        color: '#F59E0B',
        type: 'tax',
        isGlowing: true
      });
    }

    const totalExpenses = isPreviewMode ? 10000 : safeFixed + safeFlex + safeTax;
    const flexPercentage = !isPreviewMode && baseTotal > 0
      ? Math.round((safeFlex / baseTotal) * 100)
      : 40;

    const enrichedChartData = chartData.map((item) => ({
      ...item,
      percentage: totalExpenses > 0 ? Math.round((item.value / totalExpenses) * 100) : 0
    }));

    return Response.json({
      success: true,
      isPreviewMode,
      flexPercentage,
      totalExpenses,
      chartData: enrichedChartData,
      discretionaryBreakdown,
      cashFlowSource: sourceProfile
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});