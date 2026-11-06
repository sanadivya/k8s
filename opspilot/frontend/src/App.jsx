import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Boxes, CheckCircle2, ChevronDown, CircleHelp, Clock3, Cloud, Command, Gauge, GitBranch, LayoutDashboard, Plus, RefreshCw, Search, Server, ShieldCheck, Siren, TerminalSquare, X } from "lucide-react";

const API = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/$/, "");
const initialNav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "services", label: "Service inventory", icon: Boxes },
  { id: "incidents", label: "Incidents", icon: Siren },
  { id: "deployments", label: "Deployments", icon: GitBranch },
];
const titleMap = { overview: "Overview", services: "Service inventory", incidents: "Incident management", deployments: "Deployment history" };

function Badge({ children, tone = "" }) { return <span className={`badge ${tone}`}>{children}</span>; }
function StatCard({ label, value, note, icon: Icon, tone, trend }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}><Icon size={18}/></span></div><div className="stat-value">{value ?? "—"}</div><div className="stat-note">{trend ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}<span>{note}</span></div></article>;
}
function Modal({ title, onClose, children }) { return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal" onMouseDown={e => e.stopPropagation()}><header><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={18}/></button></header>{children}</section></div>; }

export default function App() {
  const [page, setPage] = useState("overview");
  const [services, setServices] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [apiState, setApiState] = useState("checking");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState("");
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  async function getJson(path, options = {}) {
    const response = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...options });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
    return body;
  }
  async function loadData() {
    setLoading(true);
    try {
      const [s, i, d, sum, health] = await Promise.all([
        getJson("/services"), getJson("/incidents"), getJson("/deployments"), getJson("/summary"),
        fetch(API.replace(/\/api$/, "/ready")).then(r => r.ok ? "online" : "degraded").catch(() => "offline")
      ]);
      setServices(s); setIncidents(i); setDeployments(d); setSummary(sum); setApiState(health);
    } catch (err) {
      setApiState("offline"); setToast(err.message);
    } finally { setLoading(false); }
  }
  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(""), 3500); return () => clearTimeout(id); }, [toast]);

  const currentRecords = page === "services" ? services : page === "incidents" ? incidents : deployments;
  const filteredRecords = useMemo(() => currentRecords.filter(item => {
    const text = Object.values(item).join(" ").toLowerCase();
    const matchesText = text.includes(query.toLowerCase());
    const matchesStatus = statusFilter === "All statuses" || item.status === statusFilter;
    return matchesText && matchesStatus;
  }), [currentRecords, query, statusFilter, page]);

  function openCreate() {
    setForm(page === "services"
      ? { name: "", environment: "dev", owner: "", version: "v1.0.0", description: "" }
      : page === "incidents"
      ? { title: "", service: services[0]?.name || "", severity: "Medium", assignee: "", description: "" }
      : { service: services[0]?.name || "", version: "v1.0.0", environment: "dev", deployer: "" });
    setModal(true);
  }
  async function submitForm(e) {
    e.preventDefault(); setSaving(true);
    try {
      await getJson(`/${page}`, { method: "POST", body: JSON.stringify(form) });
      setModal(false); setToast("Record created successfully"); await loadData();
    } catch (err) { setToast(err.message); }
    finally { setSaving(false); }
  }
  async function updateStatus(kind, record, status) {
    try { await getJson(`/${kind}/${record.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); setToast("Status updated"); await loadData(); }
    catch (err) { setToast(err.message); }
  }
  async function deleteRecord(kind, record) {
    if (!window.confirm(`Delete "${record.name || record.title || record.service}"? This cannot be undone.`)) return;
    try { await getJson(`/${kind}/${record.id}`, { method: "DELETE" }); setToast("Record deleted"); await loadData(); }
    catch (err) { setToast(err.message); }
  }

  const navTitle = titleMap[page];
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Command size={21}/></div><div><b>OpsPilot</b><small>OPERATIONS CENTER</small></div></div>
      <div className="workspace"><div className="workspace-avatar">OP</div><div><b>Platform team</b><small>Engineering workspace</small></div><ChevronDown size={15}/></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav>{initialNav.map(item => <button key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => { setPage(item.id); setQuery(""); setStatusFilter("All statuses"); }}><item.icon size={18}/><span>{item.label}</span>{item.id === "incidents" && incidents.filter(i => !["Resolved", "Closed"].includes(i.status)).length > 0 && <em>{incidents.filter(i => !["Resolved", "Closed"].includes(i.status)).length}</em>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17}/></div><b>Need a hand?</b><p>Explore the project README to learn how OpsPilot is built.</p><button onClick={() => window.open("https://kubernetes.io/docs/home/", "_blank")}>Kubernetes docs ↗</button></div><div className="profile"><div className="profile-avatar">D</div><div><b>DevOps learner</b><small>Local environment</small></div><ChevronDown size={15}/></div></div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span>/</span><b>{navTitle}</b></div><div className="top-actions"><div className={`connection ${apiState}`}><span className="pulse"></span> API {apiState === "online" ? "Operational" : apiState === "checking" ? "Checking" : "Unavailable"}</div><button className="icon-button" onClick={loadData} title="Refresh data"><RefreshCw size={17} className={loading ? "spin" : ""}/></button><div className="top-avatar">D</div></div></header>
      <div className="content">
        <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"></span> LIVE OPERATIONS</div><h1>{page === "overview" ? "Good afternoon, team" : navTitle}</h1><p>{page === "overview" ? "Here's what's happening across your services today." : page === "services" ? "Monitor ownership, environments, versions, and service health." : page === "incidents" ? "Track active issues, coordinate response, and close the loop." : "Review release activity across your environments."}</p></div>{page !== "overview" && <button className="primary-button" onClick={openCreate}><Plus size={17}/> {page === "services" ? "Register service" : page === "incidents" ? "Create incident" : "Record deployment"}</button>}</section>
        {apiState === "offline" && <div className="warning-banner"><AlertTriangle size={18}/><div><b>Backend unavailable</b><span>Start the Flask API and MongoDB, then refresh. Dashboard data cannot be loaded yet.</span></div><button onClick={loadData}>Retry</button></div>}
        {page === "overview" && <>
          <div className="section-line"><h2>Platform at a glance</h2><span><Clock3 size={14}/> Updated {summary.generated_at ? new Date(summary.generated_at).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}) : "—"}</span></div>
          <div className="stats-grid">
            <StatCard label="Registered services" value={summary.services_total} note={`${summary.services_healthy || 0} healthy right now`} icon={Server} tone="purple" trend/>
            <StatCard label="Open incidents" value={summary.incidents_open} note={`${summary.high_severity || 0} high severity`} icon={Siren} tone="orange" trend={summary.incidents_open === 0}/>
            <StatCard label="Deployments tracked" value={summary.deployments_total} note={`${summary.deployments_failed || 0} failed releases`} icon={GitBranch} tone="blue" trend/>
            <StatCard label="API connectivity" value={apiState === "online" ? "Online" : apiState === "checking" ? "Checking" : "Offline"} note="Readiness endpoint" icon={Activity} tone="green" trend={apiState === "online"}/>
          </div>
          <div className="overview-grid">
            <section className="panel service-panel"><div className="panel-heading"><div><h2>Service health</h2><p>Current state of registered services</p></div><button className="text-button" onClick={() => setPage("services")}>View inventory ↗</button></div><div className="service-list">{services.slice(0,4).map(s => <div className="service-row" key={s.id}><div className="service-logo">{s.name.slice(0,2).toUpperCase()}</div><div className="service-main"><b>{s.name}</b><small>{s.environment} · {s.version}</small></div><Badge tone={s.status === "Healthy" ? "green" : s.status === "Degraded" ? "orange" : "gray"}>{s.status}</Badge></div>)}</div></section>
            <section className="panel incident-panel"><div className="panel-heading"><div><h2>Priority incidents</h2><p>Issues that may need attention</p></div><button className="text-button" onClick={() => setPage("incidents")}>View all ↗</button></div><div className="incident-list">{incidents.filter(i => !["Resolved","Closed"].includes(i.status)).slice(0,3).map(i => <div className="incident-row" key={i.id}><div className={`severity-mark ${i.severity.toLowerCase()}`}></div><div className="incident-main"><b>{i.title}</b><small>{i.service} · {i.assignee}</small></div><Badge tone={i.severity === "High" ? "red" : i.severity === "Medium" ? "orange" : "gray"}>{i.severity}</Badge></div>)}</div></section>
          </div>
          <section className="panel deploy-panel"><div className="panel-heading"><div><h2>Recent deployments</h2><p>Latest release activity across environments</p></div><button className="text-button" onClick={() => setPage("deployments")}>Deployment history ↗</button></div><DeploymentTable rows={deployments.slice(0,4)}/></section>
        </>}
        {page !== "overview" && <section className="panel data-panel">
          <div className="toolbar"><div className="search-box"><Search size={17}/><input placeholder={`Search ${page}...`} value={query} onChange={e => setQuery(e.target.value)}/>{query && <button onClick={() => setQuery("")}><X size={14}/></button>}</div><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option>All statuses</option>{(page === "services" ? ["Healthy","Degraded","Maintenance"] : page === "incidents" ? ["Open","Investigating","Monitoring","Resolved","Closed"] : ["Succeeded","Failed","In progress"]).map(s => <option key={s}>{s}</option>)}</select><span className="record-count">{filteredRecords.length} records</span></div>
          {loading ? <div className="empty-state"><RefreshCw className="spin" size={22}/>Loading records…</div> : filteredRecords.length === 0 ? <div className="empty-state"><Search size={24}/><b>No matching records</b><span>Try another search or create a new record.</span></div> : page === "deployments" ? <DeploymentTable rows={filteredRecords} onStatus={updateStatus} onDelete={deleteRecord}/> : <div className="table-wrap"><table><thead><tr>{(page === "services" ? ["Service","Environment","Owner","Version","Status","Actions"] : ["Incident","Service","Severity","Assignee","Status","Actions"]).map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{filteredRecords.map(r => <tr key={r.id}>{page === "services" ? <><td><div className="cell-title"><div className="mini-logo">{r.name.slice(0,2).toUpperCase()}</div><div><b>{r.name}</b><small>{r.description}</small></div></div></td><td><Badge tone="blue">{r.environment}</Badge></td><td>{r.owner}</td><td><code>{r.version}</code></td><td><Badge tone={r.status === "Healthy" ? "green" : r.status === "Degraded" ? "orange" : "gray"}>{r.status}</Badge></td><td><select className="row-action" aria-label="Change service status" value={r.status} onChange={e => updateStatus("services",r,e.target.value)}><option>Healthy</option><option>Degraded</option><option>Maintenance</option></select><button className="delete-button" onClick={() => deleteRecord("services",r)}>Delete</button></td></> : <><td><div className="cell-title"><div className={`severity-mark ${r.severity.toLowerCase()}`}></div><div><b>{r.title}</b><small>{r.description}</small></div></div></td><td>{r.service}</td><td><Badge tone={r.severity === "High" ? "red" : r.severity === "Medium" ? "orange" : "gray"}>{r.severity}</Badge></td><td>{r.assignee}</td><td><Badge tone={["Resolved","Closed"].includes(r.status) ? "green" : "orange"}>{r.status}</Badge></td><td><select className="row-action" aria-label="Change incident status" value={r.status} onChange={e => updateStatus("incidents",r,e.target.value)}>{["Open","Investigating","Monitoring","Resolved","Closed"].map(s=><option key={s}>{s}</option>)}</select><button className="delete-button" onClick={() => deleteRecord("incidents",r)}>Delete</button></td></>}</tr>)}</tbody></table></div>}
        </section>}
        <footer className="footer"><span><ShieldCheck size={14}/> OpsPilot learning environment</span><span><span className="footer-dot"></span> Local development · Data stored in MongoDB</span></footer>
      </div>
    </main>
    {modal && <Modal title={page === "services" ? "Register a service" : page === "incidents" ? "Create an incident" : "Record a deployment"} onClose={() => setModal(false)}><form className="record-form" onSubmit={submitForm}>
      {Object.entries(form).map(([key,value]) => <label key={key}><span>{key.replaceAll("_"," ").replace(/^\w/, c => c.toUpperCase())}{["name","title","service","environment","owner","version","severity","assignee","deployer"].includes(key) ? " *" : ""}</span>
        {key === "environment" ? <select required value={value} onChange={e => setForm({...form,[key]:e.target.value})}>{["dev","staging","uat","prod"].map(v=><option key={v}>{v}</option>)}</select>
        : key === "severity" ? <select required value={value} onChange={e => setForm({...form,[key]:e.target.value})}>{["Low","Medium","High","Critical"].map(v=><option key={v}>{v}</option>)}</select>
        : key === "description" ? <textarea rows="3" value={value} onChange={e => setForm({...form,[key]:e.target.value})} placeholder="Add context..."/>
        : <input required={["name","title","service","owner","version","assignee","deployer"].includes(key)} value={value} onChange={e => setForm({...form,[key]:e.target.value})} placeholder={`Enter ${key.replaceAll("_"," ")}`}/>}
      </label>)}
      <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setModal(false)}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Create record"}</button></div>
    </form></Modal>}
    {toast && <div className="toast"><CheckCircle2 size={17}/>{toast}<button onClick={() => setToast("")}><X size={15}/></button></div>}
  </div>;
}

function DeploymentTable({ rows, onStatus, onDelete }) {
  if (!rows.length) return <div className="empty-state">No deployments yet.</div>;
  return <div className="table-wrap"><table><thead><tr>{["Service","Version","Environment","Deployed by","Status","Actions"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><div className="cell-title"><div className="mini-logo"><Cloud size={15}/></div><b>{r.service}</b></div></td><td><code>{r.version}</code></td><td><Badge tone="blue">{r.environment}</Badge></td><td>{r.deployer}</td><td><Badge tone={r.status === "Succeeded" ? "green" : r.status === "Failed" ? "red" : "orange"}>{r.status}</Badge></td><td>{onStatus && <><select className="row-action" value={r.status} aria-label="Change deployment status" onChange={e=>onStatus("deployments",r,e.target.value)}>{["Succeeded","Failed","In progress"].map(s=><option key={s}>{s}</option>)}</select><button className="delete-button" onClick={()=>onDelete("deployments",r)}>Delete</button></>}</td></tr>)}</tbody></table></div>;
}
