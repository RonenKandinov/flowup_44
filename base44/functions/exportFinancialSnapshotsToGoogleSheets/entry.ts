import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const snapshots = await base44.entities.FinancialSnapshot.list('-upload_date', 100);

    const createSpreadsheetRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: `FlowUp Financial Snapshots ${new Date().toISOString().slice(0, 10)}`
        },
        sheets: [
          {
            properties: {
              title: 'Financial Snapshots'
            }
          }
        ]
      })
    });

    const spreadsheet = await createSpreadsheetRes.json();
    if (!createSpreadsheetRes.ok || !spreadsheet.spreadsheetId) {
      return Response.json({ error: 'Failed to create spreadsheet', details: spreadsheet }, { status: 500 });
    }

    const values = [
      ['Upload Date', 'Current Balance', 'Projected EOM Balance', 'Total Income', 'Total Expenses', 'Risk Level', 'Risk Day', 'Avg Daily Spending'],
      ...snapshots.map((snapshot) => [
        snapshot.upload_date || '',
        snapshot.current_balance ?? '',
        snapshot.projected_eom_balance ?? '',
        snapshot.total_income ?? '',
        snapshot.total_expenses ?? '',
        snapshot.risk_level || '',
        snapshot.risk_day || '',
        snapshot.avg_daily_spending ?? ''
      ])
    ];

    const updateValuesRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.spreadsheetId}/values/Financial%20Snapshots!A1:append?valueInputOption=RAW`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    });

    const updateResult = await updateValuesRes.json();
    if (!updateValuesRes.ok) {
      return Response.json({ error: 'Failed to write spreadsheet data', details: updateResult }, { status: 500 });
    }

    return Response.json({
      success: true,
      spreadsheetId: spreadsheet.spreadsheetId,
      spreadsheetUrl: spreadsheet.spreadsheetUrl,
      exportedCount: snapshots.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});