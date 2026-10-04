const STOP = new Set(['a','an','and','as','at','be','by','for','from','in','into','is','of','on','or','the','to','with','will','must','should','that','this']);
const lines = text => String(text || '').split(/\r?\n/).map((text, index) => ({ text: text.trim(), line: index + 1 })).filter(item => item.text);
const normalized = text => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const terms = text => new Set(normalized(text).split(' ').filter(term => term.length > 2 && !STOP.has(term)));

export function checkProposalInputs({ brief, scope, acceptance, rateCard, approvedClauses, draftClauses }) {
  const flags = [];
  const scopeLines = lines(scope);
  for (const requirement of lines(brief)) {
    const words = terms(requirement.text);
    if (words.size < 2) continue;
    const matches = scopeLines.some(item => {
      const other = terms(item.text);
      const shared = [...words].filter(word => other.has(word)).length;
      return shared >= Math.min(2, words.size);
    });
    if (!matches) flags.push({
      source: `Brief line ${requirement.line}`,
      message: `Possible omitted scope: “${requirement.text}” has no two-term match in the SOW scope. Confirm the requirement with the client.`,
    });
  }
  for (const item of lines(acceptance)) {
    const vague = /\b(appropriate|reasonable|as needed|high quality|user friendly|satisfactory|soon|fast)\b/i.test(item.text);
    const measure = /\b(\d+(?:\.\d+)?\s*(?:%|days?|hours?|seconds?|ms|users?|pages?|tests?|items?)|pass(?:es)?|fail(?:s)?|verified|approved|signed|delivered|accepted)\b/i.test(item.text);
    if (vague || !measure) flags.push({
      source: `Acceptance line ${item.line}`,
      message: `Review ambiguous acceptance criterion: “${item.text}”. Add an observable result, threshold, or named approver.`,
    });
  }
  for (const [index, rate] of (Array.isArray(rateCard) ? rateCard : []).entries()) {
    const approved = Number(rate?.approvedRate);
    const quoted = Number(rate?.quotedRate);
    if (!rate?.service || !Number.isFinite(approved) || !Number.isFinite(quoted)) {
      flags.push({ source: `Rate card entry ${index + 1}`, message: 'Service, approvedRate and quotedRate are required for comparison.' });
    } else if (approved !== quoted) {
      flags.push({
        source: `Rate card entry ${index + 1} · ${rate.service}`,
        message: `Quoted rate ${quoted} differs from approved rate ${approved}; obtain commercial review before release.`,
      });
    }
  }
  const draft = normalized(draftClauses);
  for (const clause of lines(approvedClauses)) {
    const [id, ...textParts] = clause.text.split('|');
    const clauseText = textParts.join('|').trim();
    if (!id?.trim() || !clauseText) {
      flags.push({ source: `Approved clause line ${clause.line}`, message: 'Use the format clause ID | approved clause text.' });
    } else if (!draft.includes(normalized(clauseText))) {
      flags.push({
        source: `Approved clause line ${clause.line} · ${id.trim()}`,
        message: 'Approved clause text was not found in the draft clauses. Confirm the exact version with legal review.',
      });
    }
  }
  return flags;
}
