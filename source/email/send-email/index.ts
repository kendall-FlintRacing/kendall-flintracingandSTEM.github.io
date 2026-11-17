// Flint Racing & STEM: sends the emails waiting in the database queue through Resend.
//
// How it is protected:
//  - The only caller is the database, which sends its own random key in the x-fr-key header.
//    The database checks that key again when this function asks for work (email_claim).
//  - It reads the queue with the service role, which never leaves Supabase.
//  - The Resend key lives in this function's secrets (RESEND_API_KEY), never in the website.
//  - Everything typed by the public is escaped before it goes into an email.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_KEY = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
const TEST_SENDER = "onboarding@resend.dev"; // Resend's test address, used until flintracing.org is verified

type Row = {
  id: string; kind: string; to_email: string; to_name: string | null; subject: string; body: string;
  reply_to: string | null; unsub_url: string | null; template_key: string | null; attempts: number;
};
type Batch = { rows: Row[]; from_name?: string; from_addr?: string; reply_to?: string; footer?: string; site?: string };

async function rpc(name: string, args: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`${name} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

// Plain text to simple HTML. Links are made clickable; in admin alerts (which carry text typed by the
// public) only links to our own site are.
function toHtml(text: string, site: string, ownLinksOnly: boolean) {
  const link = (line: string) =>
    line.split(/(https?:\/\/[^\s<>"']+)/g).map((part, i) => {
      if (i % 2 === 0) return esc(part);
      const m = part.match(/^(.*?)([.,;:!?)]*)$/) as RegExpMatchArray;
      const url = m[1], tail = m[2];
      if (ownLinksOnly && !(url === site || url.startsWith(site + "/"))) return esc(part);
      return `<a href="${esc(url)}" style="color:#b01218">${esc(url)}</a>${esc(tail)}`;
    }).join("");
  return text.replace(/\r/g, "").split(/\n{2,}/).map((p) =>
    `<p style="margin:0 0 16px">${p.split("\n").map(link).join("<br>")}</p>`).join("");
}

const TOPICS: Record<string, string> = { "update:workshops": "seasonal workshop", "update:council": "Leadership Council" };

function build(row: Row, b: Batch) {
  const site = (b.site || "https://flintracing.org").replace(/\/+$/, "");
  const fromName = (b.from_name || "Flint Racing & STEM").replace(/[\r\n<>"]/g, " ").trim();
  const fromAddr = b.from_addr && /^[^@\s<>]+@[^@\s<>]+$/.test(b.from_addr) ? b.from_addr : TEST_SENDER;
  const notes: string[] = [], notesHtml: string[] = [];
  const note = (t: string, h?: string) => { notes.push(t); notesHtml.push(h ?? esc(t)); };
  if (b.footer) note(b.footer);
  if (row.kind === "admin_alert") note("You’re getting this because email alerts are on for your admin account. Change them in Admin → Email.");
  if (row.unsub_url) {
    const why = `You’re getting this because you asked for ${TOPICS[row.template_key || ""] || "Flint Racing"} emails.`;
    note(`${why} Unsubscribe: ${row.unsub_url}`, `${esc(why)} <a href="${esc(row.unsub_url)}" style="color:#6d7077">Unsubscribe</a>`);
  }
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6">` +
    `<div style="max-width:600px;margin:0 auto;padding:24px 14px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#191c22">` +
    `<div style="background:#ffffff;border:1px solid #d9dbde;border-radius:8px;overflow:hidden">` +
    `<div style="background:#111113;border-bottom:4px solid #d2141c;padding:16px 24px;color:#ffffff;font-size:17px;font-weight:700;letter-spacing:.03em">${esc(fromName)}</div>` +
    `<div style="padding:24px 24px 8px;font-size:16px;line-height:1.55">${toHtml(row.body, site, row.kind === "admin_alert")}</div></div>` +
    notesHtml.map((n) => `<p style="margin:14px 10px 0;font-size:12px;line-height:1.5;color:#6d7077">${n}</p>`).join("") +
    `</div></body></html>`;
  const text = row.body.replace(/\r/g, "") + (notes.length ? "\n\n-- \n" + notes.join("\n") : "");
  const msg: Record<string, unknown> = {
    from: `${fromName} <${fromAddr}>`, to: [row.to_email], subject: row.subject.replace(/[\r\n]+/g, " ").slice(0, 200), html, text,
  };
  const replyTo = row.reply_to || b.reply_to;
  if (replyTo && /^[^@\s<>]+@[^@\s<>]+$/.test(replyTo)) msg.reply_to = replyTo;
  if (row.unsub_url) msg.headers = { "List-Unsubscribe": `<${row.unsub_url}>` };
  return msg;
}

async function resend(msg: Record<string, unknown>, idem: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}`, "Idempotency-Key": idem },
    body: JSON.stringify(msg),
  });
  let j: Record<string, unknown> = {};
  try { j = await r.json(); } catch (_) { /* no body */ }
  return { status: r.status, id: String(j.id ?? ""), name: String(j.name ?? ""), message: String(j.message ?? "") };
}

async function work(key: string) {
  const started = Date.now();
  let sent = 0, handled = 0;
  while (handled < 120 && Date.now() - started < 100_000) {
    const b = (await rpc("email_claim", {
      p_key: key, p_limit: 10, p_ready: !!RESEND_KEY, p_note: RESEND_KEY ? "" : "The email service key (RESEND_API_KEY) hasn’t been added yet.",
    })) as Batch;
    const rows = b?.rows ?? [];
    if (!rows.length) break;
    let hold: { minutes: number; why: string } | null = null; // set when the provider says "no more for now"
    for (const row of rows) {
      handled++;
      const done = (result: string, extra: Record<string, unknown> = {}) =>
        rpc("email_done", { p_key: key, p_id: row.id, p_result: result, p_provider_id: null, p_error: null, p_wait_minutes: null, ...extra });
      try {
        if (hold) { await done("wait", { p_error: hold.why, p_wait_minutes: hold.minutes }); continue; }
        const msg = build(row, b);
        // The same key on every try means a retry can never send the same email twice.
        let res = await resend(msg, `fr/${row.id}`);
        if (res.status === 409) res = await resend(msg, `fr/${row.id}/${row.attempts}`);
        if (res.status >= 200 && res.status < 300) { sent++; await done("sent", { p_provider_id: res.id }); }
        else if (res.status === 429) {
          const quota = /quota/.test(res.name);
          hold = { minutes: /monthly/.test(res.name) ? 720 : quota ? 120 : 1, why: quota ? "The email service’s sending allowance is used up for now. It will try again later." : "Sending too fast. It will try again in a minute." };
          await done("wait", { p_error: hold.why, p_wait_minutes: hold.minutes });
        } else if (res.status === 403 && /domain is not verified/i.test(res.message)) await done("failed", { p_error: `The “from” address uses a domain Resend hasn’t verified yet. Clear the “from” address in Admin → Email → Setup, or finish verifying the domain in Resend.` });
        else if (res.status === 403 && /own email address/i.test(res.message)) await done("failed", { p_error: `Resend is in test mode, so it only delivers to the inbox you signed up to Resend with. Verify your domain in Resend (Setup, step 4) to email anyone else.` });
        else if (res.status === 400 || res.status === 403 || res.status === 422) await done("failed", { p_error: `The email service refused it: ${res.message || res.name || res.status}` });
        else await done("retry", { p_error: `The email service answered ${res.status}: ${res.message || res.name || "no details"}` });
      } catch (e) {
        try { await done("retry", { p_error: `Couldn’t reach the email service: ${String((e as Error)?.message ?? e).slice(0, 160)}` }); } catch (_) { /* picked up again in 10 minutes */ }
      }
      await sleep(550); // stay under the provider's per-second limit
    }
    if (hold) break;
  }
  return { sent, handled };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const key = req.headers.get("x-fr-key") ?? "";
  if (!/^[0-9a-f]{64}$/.test(key)) return new Response("Forbidden", { status: 401 });
  if (!SUPABASE_URL || !SERVICE_KEY) return new Response("Not configured", { status: 500 });
  const job = work(key).catch((e) => { console.error("send-email:", String(e?.message ?? e)); return { sent: 0, handled: 0 }; });
  // Answer right away and keep sending in the background, so the database never waits on email.
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) { rt.waitUntil(job); return new Response(JSON.stringify({ ok: true }), { status: 202, headers: { "Content-Type": "application/json" } }); }
  return new Response(JSON.stringify({ ok: true, ...(await job) }), { headers: { "Content-Type": "application/json" } });
});
