Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const fixedExpenses = payload?.fixedExpenses;
    const flexExpenses = payload?.flexExpenses;
    const taxRefundPotential = payload?.taxRefundPotential;

    const safeFixed = Number(fixedExpenses) || 0;
    const safeFlex = Number(flexExpenses) || 0;
    const safeTax = Number(taxRefundPotential) || 0;
    const isPreviewMode = safeFixed === 0 && safeFlex === 0;
    const baseTotal = safeFixed + safeFlex;

    const chartData = isPreviewMode
      ? [
          { name: 'החזרי חובות קבועים', value: 6000, color: '#ec4899', type: 'fixed' },
          { name: 'הוצאות מחיה משתנות', value: 4000, color: '#14b8a6', type: 'flex' }
        ]
      : [
          { name: 'החזרי חובות קבועים', value: safeFixed, color: '#ec4899', type: 'fixed' },
          { name: 'הוצאות מחיה משתנות', value: safeFlex, color: '#14b8a6', type: 'flex' }
        ];

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
      chartData: enrichedChartData
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});