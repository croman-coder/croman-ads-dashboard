/**
 * Diagnostic engine — analyzes campaigns/ads/adsets and detects issues.
 * Returns alerts with severity, cause, and suggested action.
 */

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  scope: 'account' | 'campaign' | 'adset' | 'ad';
  scope_id: string;
  scope_name: string;
  title: string;
  description: string;
  metric?: string;
  suggested_action: string;
  cause?: 'saturation' | 'placement' | 'audience' | 'creative' | 'budget' | 'tracking' | 'objective';
}

interface InsightsRow {
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend?: string | number;
  impressions?: string | number;
  clicks?: string | number;
  ctr?: string | number;
  cpm?: string | number;
  frequency?: string | number;
  leads: number;
  msgs?: number;
  reach?: string | number;
}

const N = (v: unknown) => Number(v) || 0;

export function analyzeInsights(
  campaignRows: InsightsRow[],
  adRows: InsightsRow[]
): Alert[] {
  const alerts: Alert[] = [];

  /* ---- Campaign-level ---- */
  for (const c of campaignRows) {
    const spend = N(c.spend);
    const leads = N(c.leads);
    const freq = N(c.frequency);
    const ctr = N(c.ctr);
    const cpm = N(c.cpm);
    const cpl = leads ? spend / leads : Infinity;
    const id = c.campaign_id || '';
    const name = c.campaign_name || '(sin nombre)';

    // No leads with significant spend
    if (spend > 20 && leads === 0) {
      alerts.push({
        id: `c-${id}-noleads`,
        severity: 'high',
        scope: 'campaign',
        scope_id: id,
        scope_name: name,
        title: 'Campaña sin leads pese al gasto',
        description: `Gastó USD ${spend.toFixed(2)} sin generar leads.`,
        metric: `${spend.toFixed(2)} USD spend / 0 leads`,
        cause: 'tracking',
        suggested_action: 'Verificar tracking, lead form configurado, y objetivo de la campaña.',
      });
    }

    // High frequency → audience saturation
    if (freq >= 5) {
      alerts.push({
        id: `c-${id}-freq-critical`,
        severity: 'critical',
        scope: 'campaign',
        scope_id: id,
        scope_name: name,
        title: 'Audiencia agotada — saturación severa',
        description: `Frecuencia ${freq.toFixed(2)}. Mismo usuario ve el ad ${Math.round(freq)} veces.`,
        metric: `frecuencia ${freq.toFixed(2)}`,
        cause: 'saturation',
        suggested_action: 'Ampliar audiencia (geo, edad) o refrescar creatividades.',
      });
    } else if (freq >= 3.5) {
      alerts.push({
        id: `c-${id}-freq-high`,
        severity: 'medium',
        scope: 'campaign',
        scope_id: id,
        scope_name: name,
        title: 'Frecuencia alta',
        description: `Frecuencia ${freq.toFixed(2)}, audiencia empezando a saturarse.`,
        metric: `frecuencia ${freq.toFixed(2)}`,
        cause: 'saturation',
        suggested_action: 'Considerar ampliar audiencia o agregar nuevas creatividades.',
      });
    }

    // CPL elevated
    if (leads > 0 && cpl > 5) {
      // Diagnose cause
      let cause: Alert['cause'] = 'placement';
      let detail = '';
      if (freq >= 3.5) {
        cause = 'saturation';
        detail = `frecuencia ${freq.toFixed(1)} sugiere saturación`;
      } else if (ctr < 0.5) {
        cause = 'creative';
        detail = `CTR ${ctr.toFixed(2)}% muy bajo, creative no engancha`;
      } else if (cpm > 5) {
        cause = 'audience';
        detail = `CPM USD ${cpm.toFixed(2)} alto, audiencia cara`;
      } else {
        cause = 'placement';
        detail = 'sin causa estructural detectada, revisar placements';
      }
      alerts.push({
        id: `c-${id}-cpl-high`,
        severity: cpl > 8 ? 'critical' : 'high',
        scope: 'campaign',
        scope_id: id,
        scope_name: name,
        title: `CPL elevado USD ${cpl.toFixed(2)}`,
        description: `${detail}.`,
        metric: `CPL USD ${cpl.toFixed(2)} · ${leads} leads`,
        cause,
        suggested_action:
          cause === 'saturation'
            ? 'Ampliar audiencia o refrescar creativos.'
            : cause === 'creative'
              ? 'Probar variantes creativas con mejor hook.'
              : cause === 'audience'
                ? 'Revisar targeting demográfico, restringir a segmentos rentables.'
                : 'Revisar mix de placements, drop los caros.',
      });
    }

    // Very low CTR
    if (N(c.impressions) > 5000 && ctr < 0.4) {
      alerts.push({
        id: `c-${id}-ctr-low`,
        severity: 'medium',
        scope: 'campaign',
        scope_id: id,
        scope_name: name,
        title: 'CTR muy bajo',
        description: `CTR ${ctr.toFixed(2)}%. Creativo no captura atención.`,
        metric: `CTR ${ctr.toFixed(2)}%`,
        cause: 'creative',
        suggested_action: 'Refrescar imagen, headline o copy del anuncio.',
      });
    }
  }

  /* ---- Ad-level ---- */
  for (const a of adRows) {
    const spend = N(a.spend);
    const leads = N(a.leads);
    const cpl = leads ? spend / leads : Infinity;
    const id = a.ad_id || '';
    const name = a.ad_name || '(sin nombre)';

    if (spend > 25 && leads === 0) {
      alerts.push({
        id: `a-${id}-noleads`,
        severity: 'high',
        scope: 'ad',
        scope_id: id,
        scope_name: name,
        title: 'Ad quema budget sin leads',
        description: `USD ${spend.toFixed(2)} gastados sin leads.`,
        metric: `${spend.toFixed(2)} USD spend / 0 leads`,
        cause: 'creative',
        suggested_action: 'Pausar este ad y probar variante o swap creative.',
      });
    }

    if (leads > 0 && cpl > 10) {
      alerts.push({
        id: `a-${id}-cpl-extreme`,
        severity: 'high',
        scope: 'ad',
        scope_id: id,
        scope_name: name,
        title: `CPL del ad extremo USD ${cpl.toFixed(2)}`,
        description: `Ad rinde mal vs promedio cuenta.`,
        metric: `CPL ${cpl.toFixed(2)} · ${leads} leads`,
        cause: 'creative',
        suggested_action: 'Pausar o iterar creative. Revisar variantes con mejor CPL en cuenta.',
      });
    }
  }

  /* Sort by severity */
  const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  alerts.sort((x, y) => order[x.severity] - order[y.severity]);
  return alerts;
}

/**
 * Compute high-level health score 0-100.
 */
export function healthScore(alerts: Alert[]): { score: number; grade: 'A' | 'B' | 'C' | 'D' | 'F'; label: string } {
  let score = 100;
  for (const a of alerts) {
    if (a.severity === 'critical') score -= 15;
    else if (a.severity === 'high') score -= 8;
    else if (a.severity === 'medium') score -= 4;
    else if (a.severity === 'low') score -= 1;
  }
  score = Math.max(0, score);
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  let label: string;
  if (score >= 90) { grade = 'A'; label = 'Excelente'; }
  else if (score >= 75) { grade = 'B'; label = 'Saludable'; }
  else if (score >= 60) { grade = 'C'; label = 'Con problemas'; }
  else if (score >= 40) { grade = 'D'; label = 'Crítico'; }
  else { grade = 'F'; label = 'Severo'; }
  return { score, grade, label };
}
