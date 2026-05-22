// functions/onboardingLinkValidate.js
//
// Public endpoint used by the customer-facing /connect/:id page. The real
// logic lives in b2bService.js under action='onboarding_validate' — we
// duplicate just the minimal request shaping here and re-use the same crypto
// rules. Kept as a separate endpoint so it stays explicitly public (no auth
// required) while the admin-only onboarding_create action sits next to it
// inside b2bService.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const hmacHex = async (secret, payload) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get('ONBOARDING_LINK_SECRET');
    if (!secret) {
      return Response.json({ error: 'ONBOARDING_LINK_SECRET not configured' }, { status: 500 });
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { session_id, token } = body || {};

    if (!session_id || !token) {
      return Response.json({ error: 'session_id and token are required' }, { status: 400 });
    }

    const session = await base44.asServiceRole.entities.CustomerOnboardingSession
      .get(session_id)
      .catch(() => null);

    if (!session) {
      return Response.json({ error: 'invalid_link' }, { status: 404 });
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      if (session.status !== 'expired') {
        await base44.asServiceRole.entities.CustomerOnboardingSession.update(session_id, {
          status: 'expired',
          failure_reason: 'Link expired'
        });
      }
      return Response.json({ error: 'expired' }, { status: 410 });
    }

    if (['completed', 'failed'].includes(session.status)) {
      return Response.json({ error: 'already_used', status: session.status }, { status: 409 });
    }

    const incomingHash = await hmacHex(secret, String(token));
    if (!safeEqual(incomingHash, session.token_hash || '')) {
      return Response.json({ error: 'invalid_token' }, { status: 401 });
    }

    if (session.status === 'pending') {
      await base44.asServiceRole.entities.CustomerOnboardingSession.update(session_id, {
        status: 'link_opened',
        link_opened_at: new Date().toISOString()
      });
    }

    return Response.json({
      session_id: session.id,
      b2b_partner_id: session.b2b_partner_id,
      b2b_partner_name: session.b2b_partner_name,
      customer_name: session.customer_name,
      customer_id: session.customer_id,
      requested_amount: session.requested_amount,
      expires_at: session.expires_at,
      status: session.status === 'pending' ? 'link_opened' : session.status
    });
  } catch (error) {
    console.error('onboardingLinkValidate error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});