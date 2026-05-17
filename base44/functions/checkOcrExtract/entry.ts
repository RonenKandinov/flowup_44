// Check OCR — extracts third-party tax id, amount, due date from a check image.
// Lean implementation: uses InvokeLLM vision (gpt_5_mini) with a strict JSON schema.
// Returns normalized fields + confidence so the UI can ask for human confirmation
// when confidence is low (Israeli check MICR / tax id recognition is imperfect).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { check_image_url } = await req.json();
    if (!check_image_url) {
      return Response.json({ error: 'check_image_url is required' }, { status: 400 });
    }

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are extracting structured data from a photo of an Israeli bank check (צ'ק).
Return ONLY the fields below. If a field is unreadable, return null and lower the confidence.
- third_party_tax_id: ח.פ או ת.ז של כותב הצ'ק (9 digits, usually printed at the bottom)
- third_party_name: שם כותב הצ'ק (the entity / person whose name is printed on top-left)
- amount: numeric amount in ₪ (use the numeric box, not the text)
- due_date: YYYY-MM-DD (תאריך פירעון)
- check_number: מספר הצ'ק
- bank_branch: בנק/סניף אם נראה
- confidence: 0-1 estimate of overall extraction quality`,
      file_urls: [check_image_url],
      model: 'gpt_5_mini',
      response_json_schema: {
        type: 'object',
        properties: {
          third_party_tax_id: { type: ['string', 'null'] },
          third_party_name: { type: ['string', 'null'] },
          amount: { type: ['number', 'null'] },
          due_date: { type: ['string', 'null'] },
          check_number: { type: ['string', 'null'] },
          bank_branch: { type: ['string', 'null'] },
          confidence: { type: 'number' }
        },
        required: ['confidence']
      }
    });

    return Response.json({ success: true, extracted: result });
  } catch (error) {
    console.error('checkOcrExtract error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});