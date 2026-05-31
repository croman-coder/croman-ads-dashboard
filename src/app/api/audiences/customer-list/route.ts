import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { insertProposal } from '@/lib/proposal-store';
import { audit } from '@/lib/user-store';

export const dynamic = 'force-dynamic';

/**
 * Customer list audience. PII MUST be SHA256-hashed client-side before POST.
 * Server receives only hashed_data. Proposal payload stores hash count + schema,
 * NOT the raw hashes echoed back. Routes through approval gate.
 */
export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await req.json();
  const { account_id, name, schema, hashed_data } = b as {
    account_id?: string;
    name?: string;
    schema?: string;
    hashed_data?: string[];
  };
  if (!account_id || !name || !schema || !Array.isArray(hashed_data) || hashed_data.length === 0) {
    return NextResponse.json({ error: 'account_id, name, schema, hashed_data[] requeridos' }, { status: 400 });
  }
  // Validate all entries look like sha256 hex (64 hex chars) — reject raw PII leak
  const valid = hashed_data.every((h) => /^[a-f0-9]{64}$/i.test(h));
  if (!valid) {
    return NextResponse.json({ error: 'hashed_data debe ser SHA256 hex (64 chars). NO enviar datos en claro.' }, { status: 400 });
  }
  if (!['EMAIL_SHA256', 'PHONE_SHA256'].includes(schema)) {
    return NextResponse.json({ error: 'schema debe ser EMAIL_SHA256 o PHONE_SHA256' }, { status: 400 });
  }

  const { id } = await insertProposal({
    proposed_by: session.email,
    account_id,
    action: 'upload_customer_list',
    scope: 'audience',
    scope_name: name,
    // Full payload (incl hashes) needed at execute; current_state shows only safe summary
    payload: { account_id, name, schema, hashed_data },
    current_state: { count: hashed_data.length, schema, note: 'PII hasheada client-side — no datos crudos' },
    reason: `Lista de clientes: ${name} · ${hashed_data.length} ${schema}`,
  });
  await audit({ user_id: session.userId, user_email: session.email, action: 'customer_list.propose', target_type: 'audience', target_id: id, metadata: { count: hashed_data.length, schema } });
  return NextResponse.json({ status: 'pending', proposal_id: id }, { status: 202 });
}
