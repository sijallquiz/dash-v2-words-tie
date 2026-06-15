/* global React, useDB, useRouter, Icon, Btn, Badge, Card, PageHead, Field, Input, Select, Table, money */
const { useState: useCalcS, useMemo: useCalcM, useEffect: useCalcE } = React;

// ===================================================================
// DATA  — ported 1:1 from WordsTie_Pricing_Calculator.xlsx
// ===================================================================
// Sheet "Language Rates": [name, category, low, average, high]  ($/source word)
const LANG_RATES = [
  ["Spanish (Latin Am.)", "Common", 0.08, 0.11, 0.14],
  ["Spanish (Spain)", "Common", 0.10, 0.13, 0.16],
  ["French", "Common", 0.10, 0.13, 0.17],
  ["French (Canadian)", "Common", 0.12, 0.15, 0.20],
  ["Italian", "Common", 0.10, 0.13, 0.17],
  ["Portuguese (Brazil)", "Common", 0.09, 0.12, 0.15],
  ["Portuguese (Europe)", "Common", 0.10, 0.13, 0.17],
  ["German", "Common", 0.12, 0.16, 0.22],
  ["Dutch", "Mid-tier", 0.13, 0.17, 0.22],
  ["Russian", "Mid-tier", 0.10, 0.14, 0.18],
  ["Polish", "Mid-tier", 0.10, 0.13, 0.18],
  ["Czech", "Mid-tier", 0.12, 0.15, 0.20],
  ["Slovak", "Mid-tier", 0.12, 0.15, 0.20],
  ["Hungarian", "Mid-tier", 0.12, 0.15, 0.20],
  ["Romanian", "Mid-tier", 0.09, 0.12, 0.17],
  ["Greek", "Mid-tier", 0.12, 0.15, 0.20],
  ["Turkish", "Mid-tier", 0.10, 0.14, 0.18],
  ["Ukrainian", "Mid-tier", 0.10, 0.13, 0.18],
  ["Bulgarian", "Mid-tier", 0.11, 0.14, 0.19],
  ["Croatian", "Mid-tier", 0.12, 0.15, 0.20],
  ["Serbian", "Mid-tier", 0.11, 0.14, 0.19],
  ["Arabic", "Less Common", 0.12, 0.16, 0.22],
  ["Hebrew", "Less Common", 0.15, 0.20, 0.28],
  ["Persian (Farsi)", "Less Common", 0.10, 0.14, 0.20],
  ["Chinese (Simplified)", "Less Common", 0.12, 0.16, 0.22],
  ["Chinese (Traditional)", "Less Common", 0.13, 0.17, 0.24],
  ["Japanese", "Less Common", 0.16, 0.22, 0.30],
  ["Korean", "Less Common", 0.14, 0.18, 0.25],
  ["Thai", "Less Common", 0.12, 0.16, 0.22],
  ["Vietnamese", "Less Common", 0.10, 0.14, 0.20],
  ["Indonesian", "Less Common", 0.10, 0.13, 0.18],
  ["Malay", "Less Common", 0.10, 0.13, 0.18],
  ["Tagalog (Filipino)", "Less Common", 0.10, 0.13, 0.18],
  ["Hindi", "Less Common", 0.08, 0.12, 0.17],
  ["Urdu", "Less Common", 0.08, 0.12, 0.17],
  ["Bengali", "Less Common", 0.09, 0.13, 0.18],
  ["Swahili", "Less Common", 0.14, 0.18, 0.25],
  ["Swedish", "Rare/Premium", 0.16, 0.21, 0.28],
  ["Norwegian", "Rare/Premium", 0.18, 0.23, 0.30],
  ["Danish", "Rare/Premium", 0.16, 0.21, 0.28],
  ["Finnish", "Rare/Premium", 0.18, 0.23, 0.32],
  ["Icelandic", "Rare/Premium", 0.22, 0.28, 0.38],
];
const TIER_INDEX = { Low: 2, Average: 3, High: 4 };
const TIER_KEY = { Low: "low", Average: "average", High: "high" };
const CAT_TONE = { "Common": "ok", "Mid-tier": "info", "Less Common": "warn", "Rare/Premium": "primary" };
const CATEGORIES = ["Common", "Mid-tier", "Less Common", "Rare/Premium"];

// Seed builders — convert the static benchmark arrays into editable DB rows.
function seedLangRates() { return LANG_RATES.map((l, i) => ({ id: i + 1, name: l[0], category: l[1], low: l[2], average: l[3], high: l[4] })); }
function seedServiceRates() {
  const mk = (group, arr) => arr.map((r) => ({ group, name: r[0], unit: r[1], low: r[2], average: r[3], high: r[4], notes: r[5] || "" }));
  const all = [...mk("perword", SVC_PERWORD), ...mk("perpage", SVC_PERPAGE), ...mk("hourly", SVC_HOURLY), ...mk("surcharge", SVC_SURCHARGE)];
  return all.map((r, i) => ({ id: i + 1, ...r }));
}

// Service rate card (Sheet "Service Rates")
const SVC_PERWORD = [
  ["Translation (general business)", "$/word", 0.08, 0.15, 0.25, "Most common pricing unit"],
  ["Proofreading / Review", "$/word", 0.03, 0.05, 0.07, "30-50% of translation rate"],
  ["Bilingual Editing", "$/word", 0.04, 0.06, 0.09, "Review against source text"],
  ["MTPE — Light Post-Editing", "$/word", 0.03, 0.04, 0.06, "Fast, fluent-enough output"],
  ["MTPE — Full Post-Editing", "$/word", 0.05, 0.07, 0.10, "Publication-quality output"],
  ["Transcreation", "$/word", 0.20, 0.30, 0.50, "Creative marketing adaptation"],
  ["Specialized (Legal/Medical/Patent)", "$/word", 0.15, 0.22, 0.35, "Subject-matter expertise"],
];
const SVC_PERPAGE = [
  ["DTP — InDesign / IDML (clean files)", "$/page", 4, 7, 12, "Most translation-friendly format"],
  ["DTP — Word / DOCX", "$/page", 3, 5, 8, "Standard DTP"],
  ["DTP — PowerPoint", "$/page", 4, 6, 10, "Slide layout adjustments"],
  ["DTP — PDF (rebuild from scratch)", "$/page", 6, 10, 18, "Highest effort; non-editable source"],
  ["DTP — Simple Layout", "$/page", 1, 3, 5, "Low-graphic documents"],
  ["Certified Translation (per page)", "$/page", 25, 50, 150, "Includes accuracy statement"],
];
const SVC_HOURLY = [
  ["DTP / Layout Engineering", "$/hour", 30, 60, 100, "Used for graphics-heavy work"],
  ["Project Management", "$/hour", 40, 55, 75, "Coordination, vendor management"],
  ["Transcreation / Creative Adaptation", "$/hour", 50, 100, 150, "Marketing & copy adaptation"],
  ["Subtitling / Captioning", "$/hour", 35, 50, 75, "Time-coding + translation"],
  ["Voiceover Production", "$/hour", 50, 75, 120, "Recording + audio editing"],
  ["File Engineering / Pre-processing", "$/hour", 35, 50, 75, "CAT-tool prep, OCR, etc."],
  ["Linguistic QA / LQA", "$/hour", 30, 45, 65, "Final language quality review"],
  ["Terminology Management", "$/hour", 35, 50, 70, "Termbase creation & maintenance"],
  ["Live Interpretation (per hour, 2hr min)", "$/hour", 120, 175, 250, "Conference/legal/medical"],
  ["Specialized Consultation", "$/hour", 75, 100, 150, "SME or expert review"],
];
const SVC_SURCHARGE = [
  ["Rush Delivery (24-48 hrs)", "% of translation", 0.20, 0.25, 0.30, "% of translation cost"],
  ["Same-Day / Urgent (<24 hrs)", "% of translation", 0.30, 0.40, 0.50, "% of translation cost"],
  ["Weekend / Holiday Work", "% of translation", 0.15, 0.20, 0.25, "% of translation cost"],
  ["Certified Translation Premium", "% of translation", 0.10, 0.15, 0.25, "% of translation cost"],
  ["Specialized Content Premium", "% of translation", 0.20, 0.35, 0.50, "Legal/medical/patent"],
  ["Volume Discount (large projects)", "% of translation", -0.05, -0.10, -0.20, "Negative %, applied to subtotal"],
];

// Default calculator state (mirrors Sheet "Quote Calculator")
const DEFAULT_CALC = {
  client_code: "", client_name: "", task_code: "", quote_date: new Date().toISOString().slice(0, 10), project_name: "",
  language: "Arabic", custom_rate: 0.16, tier: "Average", words: 1000,
  addons: [
    { label: "Proofreading / Review", on: false, rate: 0.05 },
    { label: "Bilingual Editing", on: false, rate: 0.06 },
    { label: "MTPE (Machine Translation Post-Editing)", on: false, rate: 0.05 },
    { label: "LQA", on: false, rate: 0.05 },
    { label: "OTHER", on: false, rate: 0 },
  ],
  pages: [
    { label: "DTP — InDesign / IDML", on: false, qty: 0, rate: 6 },
    { label: "DTP — Word / DOCX", on: false, qty: 0, rate: 5 },
    { label: "OCR — PDF", on: false, qty: 0, rate: 10 },
    { label: "DTP — From scratch", on: false, qty: 0, rate: 3 },
  ],
  hours: [
    { label: "DTP (hourly)", on: false, qty: 0, rate: 60 },
    { label: "Transcreation / Creative Adaptation", on: false, qty: 0, rate: 100 },
    { label: "Subtitling / Captioning", on: false, qty: 0, rate: 50 },
    { label: "Voiceover", on: false, qty: 0, rate: 75 },
    { label: "File Engineering / Pre-processing", on: false, qty: 0, rate: 50 },
    { label: "Linguistic QA / LQA", on: false, qty: 0, rate: 45 },
    { label: "Terminology Management", on: false, qty: 0, rate: 50 },
    { label: "E-learning", on: false, qty: 0, rate: 55 },
    { label: "Video Editing", on: false, qty: 0, rate: 60 },
  ],
  surcharges: [
    { label: "Rush Delivery (24-48hrs)", on: false, pct: 0.25, flat: false },
    { label: "Certified Translation", on: false, pct: 0.15, flat: false },
    { label: "Specialized Content (Legal/Medical/Tech)", on: false, pct: 0.30, flat: false },
    { label: "Volume Discount (negative %)", on: false, pct: -0.10, flat: false },
    { label: "Minimum Project Fee", on: false, pct: 50, flat: true },
  ],
  discount: 0, tax: 0,
};

const CALC_KEY = "wt_calc_quote_v2";
const num = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));

// ===================================================================
// MAIN PAGE
// ===================================================================
function Calculator() {
  const [db] = useDB();
  const [tab, setTab] = useCalcS("quote");
  // Seed editable rate tables into the store on first run.
  useCalcE(() => {
    if (!db.langRates) DB.setKey("langRates", seedLangRates());
    if (!db.serviceRates) DB.setKey("serviceRates", seedServiceRates());
  }, [db.langRates, db.serviceRates]);
  const langRates = db.langRates || [];
  const [c, setC] = useCalcS(() => {
    try { const raw = localStorage.getItem(CALC_KEY); if (raw) return { ...DEFAULT_CALC, ...JSON.parse(raw) }; } catch (e) {}
    return DEFAULT_CALC;
  });
  useCalcE(() => { try { localStorage.setItem(CALC_KEY, JSON.stringify(c)); } catch (e) {} }, [c]);

  const set = (k, v) => setC((p) => ({ ...p, [k]: v }));
  const setRow = (group, i, patch) => setC((p) => ({ ...p, [group]: p[group].map((r, x) => x === i ? { ...r, ...patch } : r) }));
  const reset = () => setC({ ...DEFAULT_CALC, quote_date: new Date().toISOString().slice(0, 10) });

  // ---- live calculations (mirror the Excel formulas) ----
  const calc = useCalcM(() => {
    const langRow = langRates.find((l) => (l.name || "").toLowerCase() === (c.language || "").toLowerCase());
    // matched language → auto rate from its tier; custom language → manual rate
    const rate = langRow ? num(langRow[TIER_KEY[c.tier] || "average"]) : num(c.custom_rate);
    const words = num(c.words);
    const transSub = words * rate;

    const addonItems = c.addons.map((a) => { const w = num(a.words ?? words); return { ...a, words: w, cost: a.on ? w * num(a.rate) : 0 }; });
    const addonTotal = addonItems.reduce((s, a) => s + a.cost, 0);

    const pageItems = c.pages.map((a) => ({ ...a, cost: a.on ? num(a.qty) * num(a.rate) : 0 }));
    const pageTotal = pageItems.reduce((s, a) => s + a.cost, 0);

    const hourItems = c.hours.map((a) => ({ ...a, cost: a.on ? num(a.qty) * num(a.rate) : 0 }));
    const hourTotal = hourItems.reduce((s, a) => s + a.cost, 0);

    // Percentage surcharges apply to the translation subtotal; the flat
    // Minimum Project Fee tops the whole project up to a floor (computed last).
    const baseBeforeMin = transSub + addonTotal + pageTotal + hourTotal;
    const pctSurTotal = c.surcharges.reduce((s, a) => (a.on && !a.flat ? s + transSub * num(a.pct) : s), 0);
    const surItems = c.surcharges.map((a) => {
      let amt = 0;
      if (a.on) {
        if (a.flat) amt = Math.max(0, num(a.pct) - (baseBeforeMin + pctSurTotal)); // Minimum Project Fee top-up
        else amt = transSub * num(a.pct);
      }
      return { ...a, amount: amt };
    });
    const surTotal = surItems.reduce((s, a) => s + a.amount, 0);

    const subtotal = transSub + addonTotal + pageTotal + hourTotal + surTotal;
    const afterDisc = subtotal * (1 - num(c.discount) / 100);
    const taxAmt = afterDisc * (num(c.tax) / 100);
    const grand = afterDisc * (1 + num(c.tax) / 100);
    const effRate = words ? grand / words : 0;

    return { rate, words, transSub, addonItems, addonTotal, pageItems, pageTotal, hourItems, hourTotal, surItems, surTotal, subtotal, afterDisc, taxAmt, grand, effRate, langRow, isCustomLang: !langRow };
  }, [c, langRates]);

  const quoteNo = useCalcM(() => {
    const yr = new Date(c.quote_date || Date.now()).getFullYear();
    const n = (db.tasks.length + db.clientInvoices.length + 1).toString().padStart(3, "0");
    return `WT-${yr}-${n}`;
  }, [c.quote_date, db.tasks.length, db.clientInvoices.length]);

  return (
    <div className="fade-in">
      <PageHead crumb={<span>Workspace · Calculator</span>} title="Quote Calculator"
        sub="Build a translation & localization quote — live pricing from the Words Tie 2025 rate cards."
        actions={<><Btn variant="ghost" icon="trash" onClick={reset}>Reset</Btn>
          <Btn variant="primary" icon="check" onClick={() => window.print()}>Export / Print</Btn></>} />

      <div className="pill-tabs">
        {[["quote", "Quote Calculator", "calculator"], ["lang", "Language Rates", "language"], ["svc", "Service Rates", "file-invoice"]].map(([k, lbl, ic]) => (
          <button key={k} className={`pill-tab${tab === k ? " on" : ""}`} onClick={() => setTab(k)}>
            <span className="flex items-center gap-8"><Icon name={ic} size={16} /> {lbl}</span>
          </button>
        ))}
      </div>

      {tab === "quote" ? <QuoteCalculator c={c} set={set} setRow={setRow} calc={calc} quoteNo={quoteNo} clients={db.clients} tasks={db.tasks} langRates={langRates} /> : null}
      {tab === "lang" ? <LanguageRateCard current={c.language} langRates={langRates} /> : null}
      {tab === "svc" ? <ServiceRateCard serviceRates={db.serviceRates || []} /> : null}
    </div>
  );
}

// ===================================================================
// QUOTE CALCULATOR TAB
// ===================================================================
function SectionTitle({ n, children, hint }) {
  return (
    <div className="calc-sec-head">
      <span className="calc-step">{n}</span>
      <div><h3 className="card__title" style={{ margin: 0 }}>{children}</h3>{hint ? <span className="muted" style={{ fontSize: 12.5 }}>{hint}</span> : null}</div>
    </div>
  );
}

function QuoteCalculator({ c, set, setRow, calc, quoteNo, clients, tasks, langRates }) {
  // pick a client code → fill the read-only client name
  const pickClient = (cl) => { set("client_code", cl.client_code); set("client_name", cl.name); };
  // pick a task → fill task code and, if linked, the client code + name
  const pickTask = (t) => {
    set("task_code", t.task_number);
    const cl = clients.find((x) => x.client_code === t.client_code);
    if (cl) { set("client_code", cl.client_code); set("client_name", cl.name); }
  };
  return (
    <>
    <div className="calc-grid">
      <div className="calc-main">
        {/* 1 — Project info */}
        <Card>
          <div className="card__body">
            <SectionTitle n="1">Project Information</SectionTitle>
            <div className="form-grid">
              <Field label="Client Code" hint="Search existing clients">
                <Combo value={c.client_code} placeholder="WT-C-0001 or name…"
                  options={clients} getValue={(cl) => cl.client_code} getLabel={(cl) => cl.name}
                  onChange={(v) => set("client_code", v)} onPick={pickClient} />
              </Field>
              <Field label="Client Name" hint="Auto-filled"><Input value={c.client_name} readOnly className="inp--auto" placeholder="—" /></Field>
              <Field label="Task Code" hint="Search existing tasks">
                <Combo value={c.task_code} placeholder="T-26-0001…"
                  options={tasks} getValue={(t) => t.task_number}
                  getLabel={(t) => (clients.find((x) => x.client_code === t.client_code) || {}).name || t.client_code || "Task"}
                  onChange={(v) => set("task_code", v)} onPick={pickTask} />
              </Field>
              <Field label="Quote Date"><DateInput value={c.quote_date} onChange={(v) => set("quote_date", v)} /></Field>
              <Field label="Quote #" hint="Auto-generated"><Input value={quoteNo} readOnly className="inp--auto" /></Field>
            </div>
          </div>
        </Card>

        {/* 2 — Translation */}
        <Card>
          <div className="card__body">
            <SectionTitle n="2" hint="Matched languages auto-load their rate; custom languages take a manual rate.">Translation</SectionTitle>
            <div className="form-grid">
              <Field label="Target Language" hint="Type to search or enter a custom language">
                <Combo value={c.language} placeholder="Arabic, French, …"
                  options={langRates} getValue={(l) => l.name} getLabel={(l) => l.category}
                  onChange={(v) => set("language", v)} onPick={(l) => set("language", l.name)} />
              </Field>
              <Field label="Pricing Tier">
                <div className="seg">
                  {["Low", "Average", "High"].map((t) => (
                    <button key={t} className={`seg__btn${c.tier === t ? " on" : ""}`} onClick={() => set("tier", t)}>{t}</button>
                  ))}
                </div>
              </Field>
              <Field label="Word Count"><Input type="number" min="0" value={c.words} onChange={(e) => set("words", e.target.value)} /></Field>
              {calc.isCustomLang
                ? <Field label="Rate / Word" hint="Custom language — enter manually"><Input type="number" step="0.01" min="0" value={c.custom_rate} onChange={(e) => set("custom_rate", e.target.value)} /></Field>
                : <Field label="Rate / Word" hint={`${c.language} · ${c.tier}`}><Input value={`$${calc.rate.toFixed(3)}`} readOnly className="inp--auto" /></Field>}
            </div>
            <div className="calc-line-total">
              <span>Translation Subtotal</span><b>{money(calc.transSub, "USD")}</b>
            </div>
          </div>
        </Card>

        {/* 3 — Per-word add-ons */}
        <Card>
          <div className="card__body">
            <SectionTitle n="3" hint="Words default to the translation count; edit per add-on.">Per-Word Add-ons</SectionTitle>
            <div className="calc-rows">
              {calc.addonItems.map((a, i) => (
                <div className={`calc-row${a.on ? " on" : ""}`} key={i}>
                  <Toggle on={a.on} onClick={() => setRow("addons", i, { on: !a.on })} />
                  <div className="calc-row__name">{a.label}</div>
                  <label className="calc-row__inp"><span>Words</span><Input type="number" min="0" value={c.addons[i].words ?? calc.words} onChange={(e) => setRow("addons", i, { words: e.target.value })} disabled={!a.on} placeholder={String(calc.words)} /></label>
                  <label className="calc-row__inp calc-row__inp--sm"><span>Rate</span><Input type="number" step="0.01" min="0" value={c.addons[i].rate} onChange={(e) => setRow("addons", i, { rate: e.target.value })} disabled={!a.on} /></label>
                  <div className="calc-row__cost">{money(a.cost, "USD")}</div>
                </div>
              ))}
            </div>
            <div className="calc-line-total"><span>Add-ons Subtotal</span><b>{money(calc.addonTotal, "USD")}</b></div>
          </div>
        </Card>

        {/* 4 — Per-page DTP */}
        <Card>
          <div className="card__body">
            <SectionTitle n="4">Per-Page Services (DTP)</SectionTitle>
            <div className="calc-rows">
              {calc.pageItems.map((a, i) => (
                <div className={`calc-row${a.on ? " on" : ""}`} key={i}>
                  <Toggle on={a.on} onClick={() => setRow("pages", i, { on: !a.on })} />
                  <div className="calc-row__name">{a.label}</div>
                  <label className="calc-row__inp"><span>Pages</span><Input type="number" min="0" value={a.qty} onChange={(e) => setRow("pages", i, { qty: e.target.value })} disabled={!a.on} /></label>
                  <label className="calc-row__inp calc-row__inp--sm"><span>Rate</span><Input type="number" min="0" value={a.rate} onChange={(e) => setRow("pages", i, { rate: e.target.value })} disabled={!a.on} /></label>
                  <div className="calc-row__cost">{money(a.cost, "USD")}</div>
                </div>
              ))}
            </div>
            <div className="calc-line-total"><span>DTP Subtotal</span><b>{money(calc.pageTotal, "USD")}</b></div>
          </div>
        </Card>

        {/* 5 — Hourly services */}
        <Card>
          <div className="card__body">
            <SectionTitle n="5">Hourly Services</SectionTitle>
            <div className="calc-rows">
              {calc.hourItems.map((a, i) => (
                <div className={`calc-row${a.on ? " on" : ""}`} key={i}>
                  <Toggle on={a.on} onClick={() => setRow("hours", i, { on: !a.on })} />
                  <div className="calc-row__name">{a.label}</div>
                  <label className="calc-row__inp"><span>Hours</span><Input type="number" min="0" value={a.qty} onChange={(e) => setRow("hours", i, { qty: e.target.value })} disabled={!a.on} /></label>
                  <label className="calc-row__inp calc-row__inp--sm"><span>Rate</span><Input type="number" min="0" value={a.rate} onChange={(e) => setRow("hours", i, { rate: e.target.value })} disabled={!a.on} /></label>
                  <div className="calc-row__cost">{money(a.cost, "USD")}</div>
                </div>
              ))}
            </div>
            <div className="calc-line-total"><span>Hourly Subtotal</span><b>{money(calc.hourTotal, "USD")}</b></div>
          </div>
        </Card>

        {/* 6 — Surcharges */}
        <Card>
          <div className="card__body">
            <SectionTitle n="6" hint="Percentages apply to the translation subtotal.">Surcharges &amp; Adjustments</SectionTitle>
            <div className="calc-rows">
              {calc.surItems.map((a, i) => (
                <div className={`calc-row${a.on ? " on" : ""}`} key={i}>
                  <Toggle on={a.on} onClick={() => setRow("surcharges", i, { on: !a.on })} />
                  <div className="calc-row__name">{a.label}</div>
                  <label className="calc-row__inp calc-row__inp--sm"><span>{a.flat ? "Flat $" : "%"}</span>
                    <Input type="number" step={a.flat ? "1" : "0.01"} value={a.flat ? a.pct : Math.round(num(a.pct) * 100)} onChange={(e) => setRow("surcharges", i, { pct: a.flat ? e.target.value : num(e.target.value) / 100 })} disabled={!a.on} /></label>
                  <div className="calc-row__cost" style={a.amount < 0 ? { color: "var(--ok)" } : undefined}>{money(a.amount, "USD")}</div>
                </div>
              ))}
            </div>
            <div className="calc-line-total"><span>Surcharges Subtotal</span><b>{money(calc.surTotal, "USD")}</b></div>
          </div>
        </Card>
      </div>

      {/* Sticky summary */}
      <div className="calc-aside">
        <Card className="calc-summary">
          <div className="card__body">
            <h3 className="card__title" style={{ marginBottom: 0 }}>Quote Summary</h3>
            <div className="calc-sum-list">
            <SumRow k="Translation Subtotal" v={calc.transSub} />
            <SumRow k="Per-Word Add-ons" v={calc.addonTotal} />
            <SumRow k="Per-Page DTP" v={calc.pageTotal} />
            <SumRow k="Hourly Services" v={calc.hourTotal} />
            <SumRow k="Surcharges / Adjustments" v={calc.surTotal} />
            <div className="calc-sum-div"></div>
            <SumRow k="Subtotal" v={calc.subtotal} strong />
            </div>

            <div className="form-grid" style={{ margin: "14px 0 4px", gap: 10 }}>
              <Field label="Discount %"><Input type="number" min="0" max="100" value={c.discount} onChange={(e) => set("discount", e.target.value)} /></Field>
              <Field label="Tax / VAT %"><Input type="number" min="0" value={c.tax} onChange={(e) => set("tax", e.target.value)} /></Field>
            </div>

            <div className="calc-grand">
              <div>
                <div className="calc-grand__label">Grand Total</div>
                <div className="calc-grand__eff">Effective rate {`$${calc.effRate.toFixed(3)}`} / word</div>
              </div>
              <div className="calc-grand__num">{money(calc.grand, "USD")}</div>
            </div>

            <p className="muted" style={{ fontSize: 11.5, marginTop: 14, lineHeight: 1.5 }}>
              Words Tie • Translation &amp; Localization Services • Quote valid 30 days from issue date.
            </p>
          </div>
        </Card>
      </div>
    </div>
    <QuotePrintDoc c={c} calc={calc} quoteNo={quoteNo} />
    </>
  );
}

// ===================================================================
// PRINT-ONLY QUOTE DOCUMENT — clean, final values, selected items only.
// Hidden on screen; shown only in @media print (see dash.css .quote-print).
// ===================================================================
function QuotePrintDoc({ c, calc, quoteNo }) {
  const M = (v) => money(v, "USD");
  const dateStr = fmtDate(c.quote_date);
  // Build one section per group, keeping ONLY enabled rows with a value.
  const sections = [];
  const transRows = calc.words > 0 ? [{ name: `Translation — ${c.language}`, qty: `${calc.words} words`, rate: `$${calc.rate.toFixed(3)}`, amt: calc.transSub }] : [];
  if (transRows.length) sections.push({ title: "Translation", rows: transRows, sub: calc.transSub });

  const addonRows = calc.addonItems.filter((a) => a.on && a.cost !== 0).map((a) => ({ name: a.label, qty: `${a.words} words`, rate: `$${num(a.rate).toFixed(3)}`, amt: a.cost }));
  if (addonRows.length) sections.push({ title: "Per-Word Add-ons", rows: addonRows, sub: calc.addonTotal });

  const pageRows = calc.pageItems.filter((a) => a.on && a.cost !== 0).map((a) => ({ name: a.label, qty: `${num(a.qty)} pages`, rate: M(num(a.rate)), amt: a.cost }));
  if (pageRows.length) sections.push({ title: "Per-Page Services (DTP)", rows: pageRows, sub: calc.pageTotal });

  const hourRows = calc.hourItems.filter((a) => a.on && a.cost !== 0).map((a) => ({ name: a.label, qty: `${num(a.qty)} hrs`, rate: M(num(a.rate)), amt: a.cost }));
  if (hourRows.length) sections.push({ title: "Hourly Services", rows: hourRows, sub: calc.hourTotal });

  const surRows = calc.surItems.filter((a) => a.on && a.amount !== 0).map((a) => ({ name: a.label, qty: a.flat ? "Flat" : `${Math.round(num(a.pct) * 100)}%`, rate: "", amt: a.amount }));
  if (surRows.length) sections.push({ title: "Surcharges & Adjustments", rows: surRows, sub: calc.surTotal });

  return (
    <div className="quote-print" aria-hidden="true">
      <div className="qp-head">
        <div>
          <div className="qp-brand">WORDS TIE</div>
          <div className="qp-brand-sub">Translation &amp; Localization Services</div>
        </div>
        <div className="qp-meta">
          <div className="qp-title">QUOTATION</div>
          <div><span>Quote #</span><b>{quoteNo}</b></div>
          <div><span>Date</span><b>{dateStr}</b></div>
        </div>
      </div>

      <div className="qp-parties">
        <div><div className="qp-k">Client</div><div className="qp-v">{c.client_name || c.client_code || "—"}</div>{c.client_code ? <div className="qp-sub">{c.client_code}</div> : null}</div>
        <div><div className="qp-k">Task</div><div className="qp-v">{c.task_code || "—"}</div></div>
      </div>

      {sections.map((s, si) => (
        <div className="qp-sec" key={si}>
          <div className="qp-sec-title">{s.title}</div>
          <table className="qp-table">
            <thead><tr><th>Item</th><th className="qp-r">Qty</th><th className="qp-r">Rate</th><th className="qp-r">Amount</th></tr></thead>
            <tbody>
              {s.rows.map((r, ri) => (
                <tr key={ri}><td>{r.name}</td><td className="qp-r">{r.qty}</td><td className="qp-r">{r.rate}</td><td className="qp-r">{M(r.amt)}</td></tr>
              ))}
              <tr className="qp-subrow"><td colSpan="3">{s.title} subtotal</td><td className="qp-r">{M(s.sub)}</td></tr>
            </tbody>
          </table>
        </div>
      ))}

      <div className="qp-totals">
        <div className="qp-trow"><span>Subtotal</span><b>{M(calc.subtotal)}</b></div>
        {num(c.discount) > 0 ? <div className="qp-trow"><span>Discount ({num(c.discount)}%)</span><b>−{M(calc.subtotal - calc.afterDisc)}</b></div> : null}
        {num(c.tax) > 0 ? <div className="qp-trow"><span>Tax / VAT ({num(c.tax)}%)</span><b>{M(calc.taxAmt)}</b></div> : null}
        <div className="qp-trow qp-grand"><span>Grand Total</span><b>{M(calc.grand)}</b></div>
        <div className="qp-eff">Effective rate ${calc.effRate.toFixed(3)} / word</div>
      </div>

      <div className="qp-foot">Words Tie · Suez canal st. Mansoura, Egypt · (+20) 102467283 · info@words-tie.com · www.words-tie.com · Quote valid 30 days from issue date.</div>
    </div>
  );
}

function Toggle({ on, onClick }) {
  return <button type="button" className={`calc-toggle${on ? " on" : ""}`} onClick={onClick} aria-pressed={on}><span></span></button>;
}
function SumRow({ k, v, strong }) {
  return <div className={`calc-sum-row${strong ? " strong" : ""}`}><span>{k}</span><span>{money(v, "USD")}</span></div>;
}

// ===================================================================
// LANGUAGE RATE CARD TAB — editable (Add / Edit / Delete)
// ===================================================================
function LanguageRateCard({ current, langRates }) {
  const [q, setQ] = useCalcS("");
  const [modal, setModal] = useCalcS(null);
  const [confirm, confirmNode] = useConfirm();
  const rows = langRates.filter((l) => !q || (l.name || "").toLowerCase().includes(q.toLowerCase()) || (l.category || "").toLowerCase().includes(q.toLowerCase()));
  const del = async (l) => { if (await confirm({ title: "Delete language?", message: `Remove “${l.name}” from the rate card and Target Language suggestions?`, danger: true, okLabel: "Delete" })) { DB.setKey("langRates", langRates.filter((x) => x.id !== l.id)); toast("Language deleted", "del"); } };
  return (
    <Card>
      {confirmNode}
      <div className="card__head">
        <h3 className="card__title">Language Rate Card <span className="muted" style={{ fontWeight: 500, fontSize: 13 }}>· USD per source word</span></h3>
        <div className="flex items-center gap-10 wrap">
          <div className="field-search"><Icon name="search" size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search language" /></div>
          <Btn variant="primary" size="sm" icon="plus" onClick={() => setModal({ mode: "new" })}>Add Language</Btn>
        </div>
      </div>
      <Table columns={[{ label: "Language", start: true }, { label: "Category" }, { label: "Low" }, { label: "Average" }, { label: "High" }, { label: "Actions", end: true }]}>
        {rows.length === 0 ? <EmptyRow span={6} icon="language" text="No languages." /> :
          rows.map((l) => (
          <tr key={l.id} style={l.name === current ? { background: "color-mix(in oklab, var(--accent) 7%, transparent)" } : undefined}>
            <td className="lead-cell cell-left">{l.name}{l.name === current ? <Badge variant="primary">selected</Badge> : null}</td>
            <td><Badge variant={CAT_TONE[l.category] || "muted"}>{l.category}</Badge></td>
            <td className="cell-mono">${num(l.low).toFixed(2)}</td>
            <td className="cell-mono lead-cell">${num(l.average).toFixed(2)}</td>
            <td className="cell-mono">${num(l.high).toFixed(2)}</td>
            <td className="text-end"><div className="row-actions">
              <button className="act act--edit" title="Edit" onClick={() => setModal({ mode: "edit", data: l })}><Icon name="edit" size={16} /></button>
              <button className="act act--del" title="Delete" onClick={() => del(l)}><Icon name="trash" size={16} /></button>
            </div></td>
          </tr>
        ))}
      </Table>
      <div className="card__body">
        <p className="muted" style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>
          Edited rates update the Quote Calculator instantly. Languages added here appear as Target Language suggestions; custom typed languages are still allowed.
        </p>
      </div>
      {modal ? <LangRateModal modal={modal} langRates={langRates} onClose={() => setModal(null)} /> : null}
    </Card>
  );
}

function LangRateModal({ modal, langRates, onClose }) {
  const editing = modal.mode === "edit";
  const [f, setF] = useCalcS(() => editing ? { ...modal.data } : { name: "", category: "Common", low: "", average: "", high: "" });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!String(f.name).trim()) { toast("Language name is required", "info"); return; }
    const clean = { ...f, low: num(f.low), average: num(f.average), high: num(f.high) };
    if (editing) { DB.setKey("langRates", langRates.map((x) => x.id === modal.data.id ? { ...x, ...clean } : x)); toast("Language updated"); }
    else { const id = (langRates.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1); DB.setKey("langRates", [{ id, ...clean }, ...langRates]); toast("Language added"); }
    onClose();
  };
  return (
    <Modal title={editing ? `Edit ${modal.data.name}` : "Add language"} onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save}>{editing ? "Save" : "Add"}</Btn></>}>
      <div className="form-grid">
        <Field label="Language Name" span={12}><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Arabic" /></Field>
        <Field label="Category" span={12}><Select value={f.category} onChange={(e) => set("category", e.target.value)}>{CATEGORIES.map((x) => <option key={x}>{x}</option>)}</Select></Field>
        <Field label="Low ($/word)"><Input type="number" step="0.01" value={f.low} onChange={(e) => set("low", e.target.value)} /></Field>
        <Field label="Average ($/word)"><Input type="number" step="0.01" value={f.average} onChange={(e) => set("average", e.target.value)} /></Field>
        <Field label="High ($/word)"><Input type="number" step="0.01" value={f.high} onChange={(e) => set("high", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

// ===================================================================
// SERVICE RATE CARD TAB — editable (Add / Edit / Delete) per group
// ===================================================================
const SVC_GROUPS = [
  { key: "perword", title: "Per-Word Services", unit: "$/word" },
  { key: "perpage", title: "Per-Page Services", unit: "$/page" },
  { key: "hourly", title: "Hourly Services", unit: "$/hour" },
  { key: "surcharge", title: "Percentage Surcharges", unit: "%" },
];
function ServiceRateCard({ serviceRates }) {
  const [modal, setModal] = useCalcS(null);
  const [confirm, confirmNode] = useConfirm();
  const del = async (r) => { if (await confirm({ title: "Delete service?", message: `Remove “${r.name}”?`, danger: true, okLabel: "Delete" })) { DB.setKey("serviceRates", serviceRates.filter((x) => x.id !== r.id)); toast("Service deleted", "del"); } };
  const block = (g) => {
    const data = serviceRates.filter((r) => r.group === g.key);
    return (
      <Card style={{ marginBottom: 18 }} key={g.key}>
        <div className="card__head">
          <h3 className="card__title">{g.title}</h3>
          <Btn variant="primary" size="sm" icon="plus" onClick={() => setModal({ mode: "new", group: g.key, unit: g.unit })}>Add Service</Btn>
        </div>
        <Table columns={[{ label: "Service", start: true }, { label: "Unit" }, { label: "Low" }, { label: "Average" }, { label: "High" }, { label: "Notes" }, { label: "Actions", end: true }]}>
          {data.length === 0 ? <EmptyRow span={7} icon="file-invoice" text="No services in this group." /> :
            data.map((r) => (
            <tr key={r.id}>
              <td className="lead-cell cell-left">{r.name}</td>
              <td className="muted" style={{ fontSize: 12.5 }}>{r.unit}</td>
              <td className="cell-mono">{fmtRate(r.low, r.unit)}</td>
              <td className="cell-mono lead-cell">{fmtRate(r.average, r.unit)}</td>
              <td className="cell-mono">{fmtRate(r.high, r.unit)}</td>
              <td className="muted cell-left" style={{ fontSize: 12.5 }}>{r.notes}</td>
              <td className="text-end"><div className="row-actions">
                <button className="act act--edit" title="Edit" onClick={() => setModal({ mode: "edit", data: r })}><Icon name="edit" size={16} /></button>
                <button className="act act--del" title="Delete" onClick={() => del(r)}><Icon name="trash" size={16} /></button>
              </div></td>
            </tr>
          ))}
        </Table>
      </Card>
    );
  };
  return (
    <div>
      {confirmNode}
      {SVC_GROUPS.map(block)}
      <p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
        Benchmark agency pricing in USD. Add, edit or delete rows to keep the rate card aligned with your pricing.
      </p>
      {modal ? <SvcRateModal modal={modal} serviceRates={serviceRates} onClose={() => setModal(null)} /> : null}
    </div>
  );
}

function SvcRateModal({ modal, serviceRates, onClose }) {
  const editing = modal.mode === "edit";
  const [f, setF] = useCalcS(() => editing ? { ...modal.data } : { name: "", unit: modal.unit || "$/word", low: "", average: "", high: "", notes: "", group: modal.group });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!String(f.name).trim()) { toast("Service name is required", "info"); return; }
    const clean = { ...f, low: num(f.low), average: num(f.average), high: num(f.high) };
    if (editing) { DB.setKey("serviceRates", serviceRates.map((x) => x.id === modal.data.id ? { ...x, ...clean } : x)); toast("Service updated"); }
    else { const id = (serviceRates.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1); DB.setKey("serviceRates", [...serviceRates, { id, ...clean }]); toast("Service added"); }
    onClose();
  };
  return (
    <Modal title={editing ? `Edit ${modal.data.name}` : "Add service"} onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save}>{editing ? "Save" : "Add"}</Btn></>}>
      <div className="form-grid">
        <Field label="Service Name" span={12}><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Unit"><Input value={f.unit} onChange={(e) => set("unit", e.target.value)} placeholder="$/word" /></Field>
        <Field label="Notes"><Input value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" /></Field>
        <Field label="Low"><Input type="number" step="0.01" value={f.low} onChange={(e) => set("low", e.target.value)} /></Field>
        <Field label="Average"><Input type="number" step="0.01" value={f.average} onChange={(e) => set("average", e.target.value)} /></Field>
        <Field label="High"><Input type="number" step="0.01" value={f.high} onChange={(e) => set("high", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
function fmtRate(v, unit) {
  if (unit && unit.includes("%")) return `${Math.round(num(v) * 100)}%`;
  return `$${num(v).toFixed(2)}`;
}

Object.assign(window, { Calculator });
