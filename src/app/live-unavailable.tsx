export function LiveUnavailable({ detail }: { detail: string }) {
  return (
    <main className="app-shell">
      <div className="mode-banner">
        <span className="mode-dot" />
        LIVE MODE · Local simulation disabled
      </div>
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">R</span>
          <span>
            ResearchVault
            <small>RMIT research participation demo</small>
          </span>
        </a>
      </header>
      <section className="hero-layout">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            TIDE REALM SETUP REQUIRED
          </div>
          <h1>Live access is not ready yet.</h1>
          <p>
            ResearchVault will not switch to local personas, demo data, or
            simulated permissions while live mode is selected.
          </p>
        </div>
        <div className="sign-in-card">
          <div className="card-eyebrow">LIVE INTEGRATION STATUS</div>
          <h2>{detail}</h2>
          <p>
            Provide a Tide adapter exported from an IGA-enabled realm, then
            complete real user enrollment and explicit app-role mapping.
            Governance and shared payload operations remain disabled until their
            live mappings are verified.
          </p>
          <div className="card-foot">
            <span className="small-dot" />
            No local or synthetic read path is available in live mode
          </div>
        </div>
      </section>
    </main>
  );
}
