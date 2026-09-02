/* ── ServiceDen, rendered ────────────────────────────────────────────────────
   Vyso's own invoicing + CRM tracker (Outreach · Sales · Leads · Customers ·
   Services · Invoices · Templates). ServiceDen runs on a single private
   account with real client data, so it is drawn here rather than
   screenshotted: the layout mirrors the product's tabs and tables, the
   values are illustrative. Static markup, CSS only. */

const LEADS = [
  ["Bramley Fresh Produce", "Proposal sent", "Follow-up Thu", "R 18 000", "warm"],
  ["Kestrel Build", "Discovery call", "Awaiting brief", "R 42 000", "warm"],
  ["Highveld Risk Partners", "Replied", "Book audit", "R 12 500", "hot"],
  ["Southgate Catering", "New", "First touch drafted", "—", "new"],
];

const INVOICES = [
  ["INV-0231", "Turn-key ops system · phase 2", "R 48 000", "Paid", "12 Aug"],
  ["INV-0234", "Order capture · WhatsApp + Outlook", "R 22 500", "Sent", "28 Aug"],
  ["INV-0236", "Monthly operate & monitor", "R 9 500", "Due 5 Sep", "01 Sep"],
];

export function ServiceDenRender() {
  return (
    <div className="vx-sd" aria-label="ServiceDen: Vyso's invoicing and CRM tracker, illustrative render">
      <div className="vx-sd-bar">
        <span className="vx-sd-brand">ServiceDen</span>
        <nav>
          {["Outreach", "Sales", "Leads", "Customers", "Services", "Invoices", "Templates"].map((t, i) => (
            <span key={t} className={i === 2 || i === 5 ? "on" : ""}>
              {t}
            </span>
          ))}
        </nav>
        <span className="vx-chip vx-chip-green">Xero synced</span>
      </div>
      <div className="vx-sd-body">
        <section>
          <header>
            <span>Leads · pipeline</span>
            <span className="vx-sd-kpi">
              R 72 500 <small>weighted</small>
            </span>
          </header>
          <table>
            <tbody>
              {LEADS.map(([name, stage, next, value, tone]) => (
                <tr key={name}>
                  <td className="k">{name}</td>
                  <td>
                    <span className={`vx-chip ${tone === "hot" ? "vx-chip-signal" : tone === "warm" ? "vx-chip-blue" : "vx-chip-muted"}`}>{stage}</span>
                  </td>
                  <td className="m">{next}</td>
                  <td className="v">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <header>
            <span>Invoices · this month</span>
            <span className="vx-sd-kpi">
              R 80 000 <small>issued</small>
            </span>
          </header>
          <table>
            <tbody>
              {INVOICES.map(([no, desc, value, status, date]) => (
                <tr key={no}>
                  <td className="k">
                    {no} <span className="m">{desc}</span>
                  </td>
                  <td>
                    <span className={`vx-chip ${status === "Paid" ? "vx-chip-green" : status === "Sent" ? "vx-chip-blue" : "vx-chip-signal"}`}>{status}</span>
                  </td>
                  <td className="m">{date}</td>
                  <td className="v">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="vx-sd-foot">
            <span className="vx-chip vx-chip-muted">Outreach · 3 drafts awaiting approval</span>
            <span className="vx-chip vx-chip-muted">Templates · 6</span>
          </div>
        </section>
      </div>
    </div>
  );
}
