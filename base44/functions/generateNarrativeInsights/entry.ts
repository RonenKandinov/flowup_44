import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function getEncryptionKey() {
  const secret = Deno.env.get('SECURE_VAULT_SECRET');
  if (!secret) throw new Error('Secure Vault encryption key missing');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt']);
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function encryptJson(data) {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const arr = new Uint8Array(cipherBuf);
  return JSON.stringify({
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(arr.slice(0, -16)),
    authTag: bufferToBase64(arr.slice(-16))
  });
}

const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('en-US');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { analysisId, metrics = {}, insights = {}, behaviorProfile = null, userId = 'anonymous' } = body;

    const dti = Number(metrics.dti || insights?.metrics?.dti || insights?.metrics?.structural_dti || 0);
    const income = Number(metrics.totalIncome || insights?.metrics?.totalIncome || 0);
    const expenses = Number(metrics.totalExpenses || insights?.metrics?.totalExpenses || 0);
    const assets = Number(metrics.liquidAssets || insights?.metrics?.liquidAssets || 0);
    const monthlyHeadroom = income - expenses;
    const noExistingLoans = !behaviorProfile?.existingLoans?.length;
    const noOverdraft = !behaviorProfile?.overdraftDays;
    const investmentDiscipline = Number(behaviorProfile?.investmentDiscipline?.avgMonthlyInvestmentOutflow || 0);
    const pledgeableValue = Number(behaviorProfile?.totalPledgeableValue || 0);

    const prompt = `כתוב ניתוח חיתום בעברית למלווה, בגישה strength-based ומדויקת.

נתונים מבניים:
- DTI: ${dti}%
- הכנסה חודשית ממוצעת: ₪${fmt(income)}
- הוצאות חודשיות ממוצעות: ₪${fmt(expenses)}
- תזרים פנוי: ₪${fmt(monthlyHeadroom)}
- נכסים נזילים: ₪${fmt(assets)}
- הלוואות קיימות: ${noExistingLoans ? 'לא זוהו' : `זוהו ${behaviorProfile.existingLoans.length}`}
- ימי אוברדראפט: ${behaviorProfile?.overdraftDays || 0}
- השקעות חודשיות ממוצעות: ₪${fmt(investmentDiscipline)}
- שווי שמרני לשעבוד: ₪${fmt(pledgeableValue)}

חובה:
1. אם DTI תקין, היעדר הלוואות קיימות, היעדר אוברדראפט או משמעת השקעה קיימים — פתח בזה כסיגנלים חיוביים.
2. אל תציג מדד תקין כסיכון.
3. כתוב למנהל אשראי, לא ללווה.
4. שמור על פרטיות — לא להזכיר שמות פרטיים.
5. החזר JSON בלבד.`;

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: 'gpt_5_mini',
      response_json_schema: {
        type: 'object',
        properties: {
          executive_summary: { type: 'string' },
          classification_reason: { type: 'string' },
          behavior_analysis: {
            type: 'object',
            properties: {
              key_positive_signals: { type: 'array', items: { type: 'string' } },
              key_risks: { type: 'array', items: { type: 'string' } }
            }
          },
          lender_risk_assessment: {
            type: 'object',
            properties: {
              portfolio_view: { type: 'string' },
              mitigations: { type: 'array', items: { type: 'string' } },
              leverage_opportunities: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        required: ['executive_summary']
      }
    });

    const narrative = {
      executive_summary: llm.executive_summary || '',
      classification_reason: llm.classification_reason || '',
      llm_analysis: llm,
      generated_at: new Date().toISOString()
    };

    if (analysisId) {
      const encrypted = await encryptJson(narrative);
      await base44.asServiceRole.entities.UnderwritingAnalysis.update(analysisId, {
        narrative_encrypted: encrypted,
        behavioral_classification: insights?.behavioral_classification || 'Generated',
        structured_metrics: {
          ...(insights?.metrics || {}),
          narrative_status: 'generated'
        }
      });
    }

    await base44.asServiceRole.entities.AuditLog.create({
      action: 'NARRATIVE_INSIGHTS_GENERATED',
      user_id: userId,
      status: 'SUCCESS',
      details: { analysis_id: analysisId || null, dti, score: metrics.score || null }
    }).catch(() => {});

    return Response.json({ success: true, narrative });
  } catch (error) {
    console.error('generateNarrativeInsights error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});