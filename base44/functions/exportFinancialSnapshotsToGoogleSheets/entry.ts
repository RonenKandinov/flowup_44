import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const report = body.report || {};
    const rows = Object.entries(report).map(([key, value]) => [key, value ?? '']);

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: { title: `FlowUp Underwriting Report ${new Date().toISOString().slice(0, 10)}` },
        sheets: [{ properties: { title: 'Underwriting Report' } }]
      })
    });

    const spreadsheet = await createRes.json();
    if (!createRes.ok || !spreadsheet.spreadsheetId) {
      return Response.json({ error: 'Failed to create spreadsheet', details: spreadsheet }, { status: 500 });
    }

    const valuesRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.spreadsheetId}/values/Underwriting%20Report!A1:B${rows.length + 1}?valueInputOption=RAW`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [
          ['Metric', 'Value'],
          ...rows
        ]
      })
    });

    const valuesResult = await valuesRes.json();
    if (!valuesRes.ok) {
      return Response.json({ error: 'Failed to write spreadsheet data', details: valuesResult }, { status: 500 });
    }

    return Response.json({ success: true, spreadsheetUrl: spreadsheet.spreadsheetUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});