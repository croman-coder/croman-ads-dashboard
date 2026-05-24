import { NextResponse } from 'next/server';
import { metaGet, getPageAccessToken } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

interface LeadRow {
  id: string;
  created_time: string;
  field_data?: Array<{ name: string; values?: string[] }>;
  ad_id?: string;
  ad_name?: string;
  adset_name?: string;
  campaign_name?: string;
  platform?: string;
  is_organic?: boolean;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pageId = url.searchParams.get('page_id');
    const since = url.searchParams.get('since');
    const until = url.searchParams.get('until');
    if (!pageId) return NextResponse.json({ error: 'page_id required' }, { status: 400 });

    const sinceTs = since ? new Date(since + 'T00:00:00-03:00').getTime() / 1000 : 0;
    const untilTs = until ? new Date(until + 'T23:59:59-03:00').getTime() / 1000 : Number.MAX_SAFE_INTEGER;

    const token = await getPageAccessToken(pageId);
    if (!token) throw new Error(`No page access token for ${pageId}`);

    // Get forms with leads
    const formsUrl = new URL(`https://graph.facebook.com/v21.0/${pageId}/leadgen_forms`);
    formsUrl.searchParams.set('access_token', token);
    formsUrl.searchParams.set('fields', 'id,name,leads_count');
    formsUrl.searchParams.set('limit', '100');
    const formsRes = await fetch(formsUrl.toString(), { cache: 'no-store' });
    const formsJson = await formsRes.json();
    if (formsJson.error) throw new Error(formsJson.error.message);
    const candidateForms = (formsJson.data || []).filter((f: { leads_count?: number }) => Number(f.leads_count || 0) > 0);

    const allLeads: Array<Record<string, string>> = [];
    for (const f of candidateForms) {
      const leadsUrl = new URL(`https://graph.facebook.com/v21.0/${f.id}/leads`);
      leadsUrl.searchParams.set('access_token', token);
      leadsUrl.searchParams.set('fields', 'id,created_time,field_data,ad_id,ad_name,adset_name,campaign_name,platform,is_organic');
      leadsUrl.searchParams.set('limit', '500');
      let nextUrl: string | undefined = leadsUrl.toString();
      const formLeads: LeadRow[] = [];
      while (nextUrl) {
        const resp: Response = await fetch(nextUrl, { cache: 'no-store' });
        const j = await resp.json();
        if (j.error) break;
        if (Array.isArray(j.data)) formLeads.push(...j.data);
        nextUrl = j.paging?.next;
        if (formLeads.length > 5000) break;
      }
      for (const lead of formLeads) {
        const t = new Date(lead.created_time).getTime() / 1000;
        if (t < sinceTs || t > untilTs) continue;
        const fields: Record<string, string> = {};
        for (const fd of lead.field_data || []) fields[fd.name] = fd.values?.[0] || '';
        allLeads.push({
          lead_id: lead.id,
          created_time: lead.created_time,
          form_id: f.id,
          form_name: f.name,
          campaign: lead.campaign_name || '',
          adset: lead.adset_name || '',
          ad: lead.ad_name || '',
          platform: lead.platform || '',
          full_name: fields.full_name || fields.first_name || '',
          phone_number: fields.phone_number || '',
          email: fields.email || '',
          city: fields.city || '',
        });
      }
    }
    allLeads.sort((a, b) => a.created_time.localeCompare(b.created_time));

    const cols = ['lead_id', 'created_time', 'full_name', 'phone_number', 'email', 'city', 'form_name', 'campaign', 'adset', 'ad', 'platform', 'form_id'];
    let csv = cols.join(',') + '\n';
    for (const l of allLeads) csv += cols.map((c) => csvEscape(l[c])).join(',') + '\n';

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leads_${pageId}_${since || 'all'}_${until || 'all'}.csv"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
