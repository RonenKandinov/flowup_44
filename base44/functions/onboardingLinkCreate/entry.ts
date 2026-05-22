// functions/onboardingLinkCreate.js
//
// Admin-only endpoint used by the partner-admin dashboard. The same logic
// also exists inside b2bService.js (action='onboarding_create'); this file
// is kept so we have a clean, dedicated admin endpoint and the dashboard
// keeps working without a frontend change.
//
// The raw token never touches the DB — we store only its HMAC-SHA256
// fingerprint and a hard expiry. The token itself is returned ONCE in the
// response so the analyst can copy/share it.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TTL_HOURS = 24;

const b64url = (bytes) => {
  const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const randomToken = (bytes = 32) => {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return b64url(buf);
};

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const secret = Deno.env.get('ONBOARDING_LINK_SECRET');
    if (!secret) {
      return Response.json({ error: 'ONBOARDING_LINK_SECRET not configured' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      b2b_partner_id,
      customer_name = '',
      customer_id = '',
      customer_phone = '',
      requested_amount = null,
      base_url = ''
    } = body || {};

    if (!b2b_partner_id) {
      return Response.json({ error: 'b2b_partner_id is required' }, { status: 400 });
    }

    const partner = await base44.asServiceRole.entities.B2BPartner.get(b2b_partner_id).catch(() => null);
    if (!partner || !partner.active) {
      return Response.json({ error: 'Partner not found or inactive' }, { status: 404 });
    }

    const rawToken = randomToken(32);
    const tokenHash = await hmacHex(secret, rawToken);
    const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000).toISOString();

    const session = await base44.asServiceRole.entities.CustomerOnboardingSession.create({
      b2b_partner_id,
      b2b_partner_name: partner.name,
      customer_name,
      customer_id,
      customer_phone,
      requested_amount: requested_amount ? Number(requested_amount) : null,
      status: 'pending',
      token_hash: tokenHash,
      expires_at: expiresAt
    });

    const origin = String(base_url || '').replace(/\/$/, '');
    const link = `${origin}/connect/${session.id}?t=${rawToken}`;

    return Response.json({
      session_id: session.id,
      link,
      expires_at: expiresAt,
      partner_name: partner.name
    });
  } catch (error) {
    console.error('onboardingLinkCreate error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});