// ── Salesforce Tooling API ─────────────────────────────────────────────
export async function fetchApexFromSF(config) {
  const { sfUrl, sfToken, sfVersion } = config;
  const base = `${sfUrl}/services/data/${sfVersion}/tooling/query?q=`;
  const headers = { Authorization: `Bearer ${sfToken}`, 'Content-Type': 'application/json' };

  const [clsRes, trgRes] = await Promise.all([
    fetch(`${base}SELECT+Id,Name,Body,LastModifiedDate,LastModifiedById+FROM+ApexClass+WHERE+NamespacePrefix+=+null+LIMIT+500`, { headers }),
    fetch(`${base}SELECT+Id,Name,Body,TableEnumOrId,LastModifiedDate+FROM+ApexTrigger+WHERE+NamespacePrefix+=+null+LIMIT+200`, { headers }),
  ]);

  if (!clsRes.ok) throw new Error(`Salesforce error: ${clsRes.status} — check token and URL`);

  const clsData = await clsRes.json();
  const trgData = await trgRes.json();

  return {
    classes: (clsData.records || []).map(r => ({ ...r, ftype: 'ApexClass' })),
    triggers: (trgData.records || []).map(r => ({ ...r, ftype: 'ApexTrigger' })),
  };
}

// ── Local analysis (fast, no API call) ────────────────────────────────
export function analyseLocally(name, ftype, body = '') {
  const b = body.toLowerCase();
  const isTest = b.includes('@istest') || name.toLowerCase().includes('_test') || name.toLowerCase().startsWith('test_') || b.includes('testmethod');

  const OBJ_MAP = {
    'opportunity': 'Opportunity', 'account': 'Account', 'contact': 'Contact',
    'lead': 'Lead', 'contract': 'Contract', 'invoice__c': 'Invoice__c',
    'subscription__c': 'Subscription__c', 'opportunitylineitem': 'OpportunityLineItem',
    'task': 'Task', 'sbqq__quoteline__c': 'SBQQ__QuoteLine__c',
    'product2': 'Product2', 'case': 'Case', 'user': 'User', 'quote': 'Quote',
  };
  const objects = [...new Set(Object.entries(OBJ_MAP).filter(([k]) => b.includes(k)).map(([, v]) => v))];

  const govRisks = [];
  if (/for\s*\([^)]+\)\s*\{[^{}]*\[select/i.test(body)) govRisks.push('SOQL inside for loop');
  if (/for\s*\([^)]+\)\s*\{[^{}]*(insert|update|delete|upsert)\s/i.test(body)) govRisks.push('DML inside for loop');
  if ((body.match(/\[select/gi) || []).length > 8) govRisks.push('High SOQL count');

  const issues = [...govRisks];
  if (b.includes('system.debug')) issues.push('Debug statements in production code');
  if (b.includes('@future')) issues.push('@future — consider Queueable for chaining');
  if (!isTest && (b.includes('callout') || b.includes('httprequest')) && !b.includes('try')) issues.push('No try-catch on HTTP callout');

  const score = Math.max(2, Math.min(10, Math.round(8 - issues.length * 1.2)));
  const rating = score >= 7 ? 'Good' : score >= 4 ? 'Needs Work' : 'Poor';

  let domain = 'General';
  if (b.includes('stripe') || b.includes('invoice') || b.includes('payment') || b.includes('overdue')) domain = 'Finance';
  else if (b.includes('subscription') || b.includes('renewal') || b.includes('onboarding')) domain = 'Customer Success';
  else if (b.includes('lead') && (ftype === 'ApexTrigger' || b.includes('convert') || b.includes('assign'))) domain = 'Marketing';
  else if (b.includes('sbqq') || (b.includes('quote') && b.includes('quoteline'))) domain = 'Quotes/CPQ';
  else if (b.includes('opportunity')) domain = 'Sales';

  let canBeFlow = 'Unlikely';
  if (isTest) canBeFlow = 'N/A';
  else if (b.includes('stripe') || b.includes('httprequest') || b.includes('callout')) canBeFlow = 'No';
  else if (b.includes('pdf') || b.includes('visualforce')) canBeFlow = 'No';
  else if (b.includes('batch')) canBeFlow = 'Unlikely';
  else if (b.includes('schedule') || b.includes('sched')) canBeFlow = 'Probably';
  else if (ftype === 'ApexTrigger' && body.length < 700 && !govRisks.length) canBeFlow = 'Yes';
  else if (ftype === 'ApexTrigger') canBeFlow = 'Probably';
  else if (b.includes('email') && !b.includes('batch')) canBeFlow = 'Probably';

  return {
    isTest, objects, domain, rating, score,
    issues: issues.join('; ') || 'None',
    govRisks: govRisks.join('; ') || 'None',
    hasGovRisk: govRisks.length > 0,
    canBeFlow,
    description: `${ftype} handling automation for ${objects.slice(0, 2).join(', ') || 'Salesforce'} records.`,
  };
}

// ── AI API helper — supports both Anthropic direct and Portkey gateway ──
function getAIConfig(apiKey) {
  // Portkey keys start with pk-
  const isPortkey = apiKey && apiKey.startsWith('pk-');
  return {
    isPortkey,
    url: isPortkey
      ? 'https://api.portkey.ai/v1/messages'
      : 'https://api.anthropic.com/v1/messages',
    headers: isPortkey
      ? { 'Content-Type': 'application/json', 'x-portkey-api-key': apiKey, 'x-portkey-provider': 'anthropic', 'anthropic-version': '2023-06-01' }
      : { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
  };
}

export async function callAI(prompt, apiKey, maxTokens = 1200) {
  const cfg = getAIConfig(apiKey);
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: cfg.headers,
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`AI API error ${res.status}: ${errText.substring(0, 200)}`);
  }
  const data = await res.json();
  return (data.content || []).map(b => b.text || '').join('');
}

// ── Claude AI analysis ─────────────────────────────────────────────────
export async function analyseWithClaude(name, ftype, body, anthropicKey) {
  const prompt = `You are a Salesforce Apex expert. Analyse this ${ftype} named "${name}" and return ONLY a valid JSON object with these exact keys:
{
  "description": "2-3 sentence plain English description of what this code does",
  "domain": "one of: Sales, Marketing, Customer Success, Quotes/CPQ, Finance, Service, Operations, General",
  "objects": ["array of Salesforce objects referenced"],
  "fields": ["key fields referenced as Object.Field"],
  "qualityRating": "Good, Needs Work, or Poor",
  "qualityScore": number 1-10,
  "qualityIssues": ["array of specific issues found"],
  "qualityStrengths": ["array of good practices"],
  "canBeFlow": "Yes, Probably, Unlikely, or No",
  "flowReason": "1-2 sentences explaining why or why not",
  "hasGovernorRisk": true or false,
  "governorIssues": ["array of governor limit risks or empty array"],
  "recommendations": ["array of specific actionable improvements"]
}

Apex code (first 2500 chars):
${body.substring(0, 2500)}`;

  const text = await callAI(prompt, anthropicKey, 1200);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}') + 1;
  if (start < 0 || end <= start) throw new Error('No JSON in response');
  return JSON.parse(text.slice(start, end));
}

// ── Debug & fix analysis ───────────────────────────────────────────────
export async function debugWithClaude(code, codeType, objective, symptoms, anthropicKey) {
  const prompt = `You are a senior Salesforce developer. A user needs help debugging and optimising their ${codeType}.

WHAT IT SHOULD DO:
${objective}

${symptoms ? `SYMPTOMS / ERRORS OBSERVED:\n${symptoms}\n` : ''}
CODE:
${code.substring(0, 4000)}

Respond with ONLY a valid JSON object:
{
  "summary": "2-3 sentence diagnosis of the main issues",
  "bugs": [
    {
      "severity": "Critical, High, Medium, or Low",
      "title": "short title",
      "description": "what is wrong",
      "location": "where in the code (line or method name if identifiable)",
      "fix": "exact fix with code snippet if applicable",
      "fixCode": "the corrected code snippet or null"
    }
  ],
  "optimisations": [
    {
      "title": "short title",
      "description": "what to improve",
      "benefit": "what this improves (performance / maintainability / governor limits)",
      "code": "example code or null"
    }
  ],
  "canBeFlow": "Yes, Probably, Unlikely, or No",
  "flowNotes": "explanation of whether a Flow could replace this",
  "governorRisks": ["list of governor limit risks found or empty array"],
  "testingNotes": "what to test after making the suggested fixes",
  "overallScore": number 1-10,
  "overallRating": "Good, Needs Work, or Poor"
}`;

  const text = await callAI(prompt, anthropicKey, 2000);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}') + 1;
  if (start < 0 || end <= start) throw new Error('No JSON in response');
  return JSON.parse(text.slice(start, end));
}

// ── Google Sheets ──────────────────────────────────────────────────────
export async function writeToSheet(config, rows) {
  const { sheetId, sheetTab, gapiKey, oauthToken } = config;
  const range = encodeURIComponent(`${sheetTab}!A1:S${rows.length + 1}`);
  const authHeader = oauthToken ? `Bearer ${oauthToken}` : null;

  const headers = [
    'Name','Type','Is Test Class','Domain','Description','Objects Affected',
    'Key Fields','Quality Rating','Quality Score','Quality Issues','Strengths',
    'Governor Risk','Governor Issues','Can Be Flow?','Flow Notes',
    'Lines of Code','Last Modified','Change Status','Last Analysed',
  ];

  const values = [headers, ...rows.map(r => [
    r.name, r.ftype, r.isTest ? 'Yes' : 'No', r.domain, r.description,
    Array.isArray(r.objects) ? r.objects.join(', ') : r.objects,
    Array.isArray(r.fields) ? r.fields.join(', ') : (r.fields || ''),
    r.qualityRating || r.rating, r.qualityScore || r.score,
    Array.isArray(r.qualityIssues) ? r.qualityIssues.join('; ') : (r.qualityIssues || r.issues || ''),
    Array.isArray(r.qualityStrengths) ? r.qualityStrengths.join('; ') : '',
    r.hasGovernorRisk || r.hasGovRisk ? 'YES' : 'No',
    Array.isArray(r.governorIssues) ? r.governorIssues.join('; ') : (r.governorIssues || r.govRisks || ''),
    r.canBeFlow, r.flowReason || r.flowNotes || '',
    r.linesOfCode || (r.body || '').split('\n').length,
    r.lastModified || '', r.changeStatus || 'Analysed',
    new Date().toISOString().split('T')[0],
  ])];

  const fetchOpts = {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify({ values, majorDimension: 'ROWS' }),
  };

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=RAW${gapiKey ? `&key=${gapiKey}` : ''}`;
  const res = await fetch(url, fetchOpts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Sheets error: ${res.status}`);
  }
  return await res.json();
}

// ── Config persistence ─────────────────────────────────────────────────
const CONFIG_KEY = 'sfdc_tool_config';

export function saveConfig(cfg) {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); } catch (e) {}
}

export function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

// ── Timestamp cache (change detection) ────────────────────────────────
const TS_KEY = 'sfdc_apex_timestamps';

export function getTimestamps() {
  try { return JSON.parse(localStorage.getItem(TS_KEY) || '{}'); } catch { return {}; }
}

export function saveTimestamps(ts) {
  try { localStorage.setItem(TS_KEY, JSON.stringify(ts)); } catch {}
}
