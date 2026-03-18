import { useState, useMemo, createContext, useContext } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// THEME SYSTEM — Light + Dark, GJS/VANT palette
// ═══════════════════════════════════════════════════════════════════════════

const themes = {
  dark: {
    bg0: '#07090f',
    bg1: '#0c1120',
    bg2: '#111a2e',
    bg3: '#162040',
    border0: 'rgba(94,183,241,0.08)',
    border1: 'rgba(94,183,241,0.15)',
    border2: 'rgba(94,183,241,0.28)',
    text0: '#ffffff',
    text1: '#d0d8e8',
    text2: '#8899b4',
    text3: '#556680',
    accent: '#5eb7f1',
    accentDim: 'rgba(94,183,241,0.12)',
    accentText: '#5eb7f1',
    green: '#34d399',
    red: '#f87171',
    amber: '#fbbf24',
    orange: '#fb923c',
    cardBg: '#0c1120',
    inputBg: '#111a2e',
    dropdownBg: '#162040',
    shadowColor: 'rgba(0,0,0,0.6)',
  },
  light: {
    bg0: '#f0f2f5',
    bg1: '#ffffff',
    bg2: '#f7f8fa',
    bg3: '#ebeef3',
    border0: 'rgba(27,42,123,0.08)',
    border1: 'rgba(27,42,123,0.14)',
    border2: 'rgba(27,42,123,0.25)',
    text0: '#0f172a',
    text1: '#334155',
    text2: '#64748b',
    text3: '#94a3b8',
    accent: '#2563eb',
    accentDim: 'rgba(37,99,235,0.08)',
    accentText: '#1d4ed8',
    green: '#059669',
    red: '#dc2626',
    amber: '#d97706',
    orange: '#ea580c',
    cardBg: '#ffffff',
    inputBg: '#f7f8fa',
    dropdownBg: '#ffffff',
    shadowColor: 'rgba(0,0,0,0.12)',
  },
};

const ThemeCtx = createContext(themes.dark);
const useTheme = () => useContext(ThemeCtx);

const vNavy = '#1B2A7B';
const vOrange = '#E8652A';
const fontPrimary = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const fontMono = "'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace";

// ─── Mock Data ──────────────────────────────────────────────────────────────

const mockUser = { name: 'Kevin', email: 'kevin@vantpg.com', role: 'admin' };
const mockOrg = { name: 'VANT Production Group', plan: 'pro' };
const mockGroups = [
  { id: 'g1', name: 'Main Lobby' },
  { id: 'g2', name: 'Ballroom A' },
  { id: 'g3', name: 'Conference Rooms' },
  { id: 'g4', name: 'Exterior LED' },
];
const mockDisplays = [
  { id: '1', name: 'Lobby Welcome Board', status: 'online', hw: 'pi5', orient: 'landscape', w: 3840, h: 2160, loc: 'Main Lobby Entrance', ip: '10.0.1.101', gid: 'g1', tags: ['welcome', '4K'], hb: new Date(Date.now() - 30000).toISOString(), tel: { cpu: 22, temp: 48, disk: 34, mem: 41 } },
  { id: '2', name: 'Lobby Wayfinding', status: 'online', hw: 'nuc', orient: 'portrait', w: 2160, h: 3840, loc: 'Main Lobby East', ip: '10.0.1.102', gid: 'g1', tags: ['wayfinding'], hb: new Date(Date.now() - 45000).toISOString(), tel: { cpu: 15, temp: 42, disk: 28, mem: 35 } },
  { id: '3', name: 'Ballroom A Session', status: 'online', hw: 'mac_mini', orient: 'landscape', w: 1920, h: 1080, loc: 'Ballroom A Entrance', ip: '10.0.2.101', gid: 'g2', tags: ['session', 'event'], hb: new Date(Date.now() - 15000).toISOString(), tel: { cpu: 8, temp: 38, disk: 18, mem: 22 } },
  { id: '4', name: 'Ballroom A Left LED', status: 'online', hw: 'pi4', orient: 'portrait', w: 1080, h: 1920, loc: 'Ballroom A Left Wall', ip: '10.0.2.102', gid: 'g2', tags: ['LED', 'posterboard'], hb: new Date(Date.now() - 60000).toISOString(), tel: { cpu: 45, temp: 56, disk: 62, mem: 58 } },
  { id: '5', name: 'Conf Room 201', status: 'offline', hw: 'pi4', orient: 'landscape', w: 1920, h: 1080, loc: 'Conference Room 201', ip: '10.0.3.101', gid: 'g3', tags: ['meeting'], hb: new Date(Date.now() - 3600000).toISOString(), tel: { cpu: 0, temp: 32, disk: 45, mem: 12 } },
  { id: '6', name: 'Conf Room 202', status: 'online', hw: 'pi5', orient: 'landscape', w: 1920, h: 1080, loc: 'Conference Room 202', ip: '10.0.3.102', gid: 'g3', tags: ['meeting'], hb: new Date(Date.now() - 20000).toISOString(), tel: { cpu: 12, temp: 44, disk: 30, mem: 28 } },
  { id: '7', name: 'Exterior North Pillar', status: 'error', hw: 'nuc', orient: 'portrait', w: 768, h: 2048, loc: 'North Entrance Pillar', ip: '10.0.4.101', gid: 'g4', tags: ['LED', 'outdoor'], hb: new Date(Date.now() - 900000).toISOString(), tel: { cpu: 88, temp: 78, disk: 92, mem: 85 } },
  { id: '8', name: 'Exterior South Pillar', status: 'online', hw: 'nuc', orient: 'portrait', w: 768, h: 2048, loc: 'South Entrance Pillar', ip: '10.0.4.102', gid: 'g4', tags: ['LED', 'outdoor'], hb: new Date(Date.now() - 10000).toISOString(), tel: { cpu: 31, temp: 51, disk: 40, mem: 38 } },
  { id: '9', name: 'VIP Lounge Display', status: 'pending', hw: 'mac_mini', orient: 'landscape', w: 3840, h: 2160, loc: 'VIP Lounge', gid: 'g1', tags: ['VIP', '4K'], hb: null, tel: {} },
  { id: '10', name: 'Registration Desk A', status: 'online', hw: 'pi5', orient: 'landscape', w: 1920, h: 1080, loc: 'Registration Area', ip: '10.0.1.110', gid: 'g1', tags: ['registration'], hb: new Date(Date.now() - 5000).toISOString(), tel: { cpu: 18, temp: 40, disk: 22, mem: 30 } },
];
const mockNotifs = [
  { id: 'n1', sev: 'error', title: 'Exterior North Pillar — CPU temp critical (78°C)', read: false, at: new Date(Date.now() - 900000).toISOString() },
  { id: 'n2', sev: 'warning', title: 'Conf Room 201 offline for 1 hour', read: false, at: new Date(Date.now() - 3600000).toISOString() },
  { id: 'n3', sev: 'info', title: 'VIP Lounge Display provisioned', read: true, at: new Date(Date.now() - 7200000).toISOString() },
  { id: 'n4', sev: 'info', title: 'Ballroom A Left LED sync complete', read: true, at: new Date(Date.now() - 14400000).toISOString() },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const hwLabel = { pi4: 'RPi 4', pi5: 'RPi 5', nuc: 'NUC', x86: 'x86 PC', mac_mini: 'Mac Mini' };
const hwIcon = { pi4: '🍓', pi5: '🍓', nuc: '🖥️', x86: '💻', mac_mini: '🍎' };

function timeAgo(d) {
  if (!d) return 'Never';
  const s = Math.max(0, Date.now() - new Date(d).getTime());
  const m = Math.floor(s / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Icons ──────────────────────────────────────────────────────────────────

const I = {
  displays: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 20 20"><rect x="2" y="3" width="16" height="11" rx="1.5"/><path d="M7 17h6M10 14v3"/></svg>,
  media: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 20 20"><rect x="2" y="2" width="16" height="16" rx="2"/><circle cx="7" cy="7" r="1.5"/><path d="M18 13l-4-4-8 8"/></svg>,
  playlists: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 20 20"><path d="M3 5h10M3 10h10M3 15h7M15 10v7l4-3.5L15 10"/></svg>,
  schedule: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 20 20"><rect x="2" y="3" width="16" height="15" rx="2"/><path d="M2 8h16M6 1v4M14 1v4"/></svg>,
  deploy: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 20 20"><path d="M12 2l4 4-8 8-4 1 1-4 8-8z"/><path d="M10.5 3.5l4 4"/></svg>,
  alerts: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 20 20"><path d="M10 2a5 5 0 015 5c0 3.5 2 5 2 5H3s2-1.5 2-5a5 5 0 015-5z"/><path d="M8.5 17a2 2 0 003 0"/></svg>,
  settings: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 20 20"><circle cx="10" cy="10" r="3"/><path d="M10 1v2M10 17v2M3.5 3.5l1.4 1.4M15.1 15.1l1.4 1.4M1 10h2M17 10h2M3.5 16.5l1.4-1.4M15.1 4.9l1.4-1.4"/></svg>,
  search: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 16 16"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/></svg>,
  plus: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16"><path d="M8 2v12M2 8h12"/></svg>,
  back: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 16 16"><path d="M10 4l-4 4 4 4"/></svg>,
  grid: <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>,
  list: <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><rect x="1" y="2" width="14" height="2.5" rx=".5"/><rect x="1" y="6.75" width="14" height="2.5" rx=".5"/><rect x="1" y="11.5" width="14" height="2.5" rx=".5"/></svg>,
  sun: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 20 20"><circle cx="10" cy="10" r="4"/><path d="M10 2v2M10 16v2M3.5 3.5l1.4 1.4M15.1 15.1l1.4 1.4M2 10h2M16 10h2M3.5 16.5l1.4-1.4M15.1 4.9l1.4-1.4"/></svg>,
  moon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 20 20"><path d="M17.3 14.3A8 8 0 115.7 2.7a6 6 0 0011.6 11.6z"/></svg>,
};

const navItems = [
  { id: 'displays', label: 'Displays', icon: I.displays, badge: 1 },
  { id: 'media', label: 'Media', icon: I.media },
  { id: 'playlists', label: 'Playlists', icon: I.playlists },
  { id: 'schedule', label: 'Schedule', icon: I.schedule },
  { id: 'provisioning', label: 'Deploy', icon: I.deploy },
  { id: 'alerts', label: 'Alerts', icon: I.alerts, badge: 2 },
  { id: 'settings', label: 'Settings', icon: I.settings },
];

// ═══════════════════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════════════════

export default function App() {
  const [mode, setMode] = useState('dark');
  const t = themes[mode];

  const [page, setPage] = useState('displays');
  const [collapsed, setCollapsed] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [selected, setSelected] = useState(null);
  const [statusF, setStatusF] = useState('all');
  const [groupF, setGroupF] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');

  const statusCfg = useMemo(() => ({
    online:  { c: t.green,  bg: t.green + '14',  label: 'Online' },
    offline: { c: t.red,    bg: t.red + '12',    label: 'Offline' },
    pending: { c: t.amber,  bg: t.amber + '12',  label: 'Pending' },
    error:   { c: t.orange, bg: t.orange + '12',  label: 'Error' },
  }), [t]);

  const sevColor = { critical: t.red, error: t.orange, warning: t.amber, info: t.accent };

  const summary = useMemo(() => ({
    total: mockDisplays.length,
    online: mockDisplays.filter(d => d.status === 'online').length,
    offline: mockDisplays.filter(d => d.status === 'offline').length,
    error: mockDisplays.filter(d => d.status === 'error').length,
    pending: mockDisplays.filter(d => d.status === 'pending').length,
  }), []);

  const filtered = useMemo(() => mockDisplays.filter(d => {
    if (statusF !== 'all' && d.status !== statusF) return false;
    if (groupF !== 'all' && d.gid !== groupF) return false;
    if (search) {
      const q = search.toLowerCase();
      return d.name.toLowerCase().includes(q) || d.loc?.toLowerCase().includes(q) || d.tags.some(tg => tg.toLowerCase().includes(q));
    }
    return true;
  }), [statusF, groupF, search]);

  const unread = mockNotifs.filter(n => !n.read).length;
  const sw = collapsed ? 62 : 224;

  return (
    <ThemeCtx.Provider value={t}>
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: t.bg0, fontFamily: fontPrimary, color: t.text1, fontSize: 14 }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        button{transition:all .12s ease;font-family:${fontPrimary}}
        button:hover{filter:brightness(1.08)}
        button:active{transform:scale(.98)}
        input::placeholder{color:${t.text3}}
        select option{background:${t.dropdownBg};color:${t.text0}}
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${t.border1};border-radius:3px}
        .card-h:hover{border-color:${t.border2} !important;box-shadow:0 4px 24px ${t.shadowColor} !important}
        .row-h:hover{background:${t.bg2} !important}
        .act-h:hover{border-color:${t.accent} !important;color:${t.accent} !important}
      `}</style>

      {/* ═══ SIDEBAR ═══ */}
      <aside style={{ width: sw, height: '100vh', background: t.bg1, borderRight: `1px solid ${t.border0}`, display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'width .2s ease', overflow: 'hidden' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '20px 15px' : '20px 18px', minHeight: 60 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${vNavy}, ${mode === 'dark' ? t.accent : vOrange})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 2px 8px ${t.shadowColor}` }}>
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: 1 }}>V</span>
          </div>
          {!collapsed && <div style={{ display: 'flex', flexDirection: 'column', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: t.text0, letterSpacing: 3 }}>VANT</span>
            <span style={{ fontSize: 11, color: t.accent, letterSpacing: 2, fontWeight: 500, marginTop: -2 }}>SIGNAGE</span>
          </div>}
        </div>

        <div style={{ height: 1, margin: '0 14px', background: `linear-gradient(90deg, transparent, ${t.border1}, transparent)` }} />

        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(n => {
            const act = page === n.id && !selected;
            return (
              <button key={n.id} onClick={() => { setPage(n.id); setSelected(null); }} title={collapsed ? n.label : undefined} style={{
                display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', borderRadius: 8, border: 'none',
                background: act ? t.accentDim : 'transparent', cursor: 'pointer', width: '100%', textAlign: 'left',
                justifyContent: collapsed ? 'center' : 'flex-start', paddingLeft: collapsed ? 0 : 14,
              }}>
                <span style={{ display: 'flex', flexShrink: 0, color: act ? t.accent : t.text2 }}>{n.icon}</span>
                {!collapsed && <span style={{ fontSize: 14, color: act ? t.text0 : t.text1, fontWeight: act ? 600 : 400 }}>{n.label}</span>}
                {!collapsed && n.badge > 0 && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, background: t.accent, color: mode === 'dark' ? '#07090f' : '#fff', borderRadius: 8, padding: '1px 7px', lineHeight: '18px' }}>{n.badge}</span>}
              </button>
            );
          })}
        </nav>

        {/* Theme toggle + collapse */}
        <div style={{ display: 'flex', gap: 4, padding: '4px 8px' }}>
          <button onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')} title={mode === 'dark' ? 'Light mode' : 'Dark mode'} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8, border: 'none', borderRadius: 8, background: t.accentDim, color: t.accent, cursor: 'pointer' }}>
            {mode === 'dark' ? I.sun : I.moon}
            {!collapsed && <span style={{ fontSize: 13 }}>{mode === 'dark' ? 'Light' : 'Dark'}</span>}
          </button>
          <button onClick={() => setCollapsed(!collapsed)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, border: 'none', borderRadius: 8, background: 'transparent', color: t.text2, cursor: 'pointer' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ transform: collapsed ? 'rotate(0)' : 'rotate(180deg)', transition: 'transform .2s' }} viewBox="0 0 16 16"><path d="M6 4l4 4-4 4"/></svg>
          </button>
        </div>

        {!collapsed && <div style={{ padding: '12px 18px', borderTop: `1px solid ${t.border0}` }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: t.text1 }}>{mockOrg.name}</div>
          <div style={{ fontSize: 12, color: t.accent, marginTop: 2 }}>{mockOrg.plan} plan</div>
        </div>}
      </aside>

      {/* ═══ MAIN ═══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <header style={{ height: 56, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${t.border0}`, background: t.bg1, flexShrink: 0 }}>
          <h1 style={{ fontSize: 18, fontWeight: 400, color: t.text0, margin: 0 }}>
            {selected ? selected.name : (navItems.find(n => n.id === page)?.label || 'Dashboard')}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Notifications */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setShowNotif(!showNotif); setShowUser(false); }} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, border: `1px solid ${t.border0}`, background: t.bg2, color: t.text2, cursor: 'pointer' }}>
                {I.alerts}
                {unread > 0 && <span style={{ position: 'absolute', top: -2, right: -2, fontSize: 10, fontWeight: 700, background: t.red, color: '#fff', borderRadius: 8, padding: '0 5px', lineHeight: '16px', minWidth: 16, textAlign: 'center' }}>{unread}</span>}
              </button>
              {showNotif && <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 340, background: t.dropdownBg, border: `1px solid ${t.border1}`, borderRadius: 12, boxShadow: `0 16px 48px ${t.shadowColor}`, zIndex: 200, animation: 'fadeIn .15s ease', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: t.text2, borderBottom: `1px solid ${t.border0}`, textTransform: 'uppercase', letterSpacing: .5 }}>Notifications</div>
                {mockNotifs.map(n => (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${t.border0}`, opacity: n.read ? .55 : 1, cursor: 'pointer' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: sevColor[n.sev] || t.accent, flexShrink: 0, marginTop: 6 }} />
                    <div>
                      <div style={{ fontSize: 13, color: t.text0, lineHeight: 1.5 }}>{n.title}</div>
                      <div style={{ fontSize: 12, color: t.text2, marginTop: 3 }}>{timeAgo(n.at)}</div>
                    </div>
                  </div>
                ))}
              </div>}
            </div>
            {/* User */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setShowUser(!showUser); setShowNotif(false); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 8, border: `1px solid ${t.border0}`, background: t.bg2, color: t.text0, cursor: 'pointer' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${vNavy}, ${t.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>K</div>
                <span style={{ fontSize: 14, fontWeight: 400 }}>Kevin</span>
              </button>
              {showUser && <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 220, background: t.dropdownBg, border: `1px solid ${t.border1}`, borderRadius: 12, boxShadow: `0 16px 48px ${t.shadowColor}`, zIndex: 200, overflow: 'hidden', animation: 'fadeIn .15s ease' }}>
                <div style={{ padding: '12px 16px', fontSize: 13, color: t.text1 }}>{mockUser.email}</div>
                <div style={{ padding: '4px 16px 12px' }}><span style={{ fontSize: 12, fontWeight: 600, color: t.accent, background: t.accentDim, padding: '3px 10px', borderRadius: 6 }}>admin</span></div>
                <div style={{ height: 1, background: t.border0 }} />
                <button style={{ display: 'block', width: '100%', padding: '12px 16px', border: 'none', background: 'transparent', color: t.red, fontSize: 14, textAlign: 'left', cursor: 'pointer' }}>Sign out</button>
              </div>}
            </div>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflow: 'auto', padding: 24 }} onClick={() => { setShowNotif(false); setShowUser(false); }}>
          {selected ? (
            <DetailView d={selected} onBack={() => setSelected(null)} statusCfg={statusCfg} />
          ) : page === 'displays' ? (
            <>
              {/* Fleet Summary */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                {[
                  { k: 'all', l: 'Total Displays', v: summary.total, c: t.accent },
                  { k: 'online', l: 'Online', v: summary.online, c: t.green },
                  { k: 'offline', l: 'Offline', v: summary.offline, c: t.red },
                  { k: 'error', l: 'Errors', v: summary.error, c: t.orange },
                  { k: 'pending', l: 'Pending', v: summary.pending, c: t.amber },
                ].map(s => (
                  <button key={s.k} onClick={() => setStatusF(s.k)} style={{
                    flex: '1 1 140px', padding: '16px 20px', borderRadius: 12, background: t.cardBg,
                    border: `1.5px solid ${statusF === s.k ? s.c : t.border0}`, cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{ fontSize: 30, fontWeight: 300, color: s.c, lineHeight: 1 }}>{s.v}</div>
                    <div style={{ fontSize: 13, color: t.text2, marginTop: 8, fontWeight: 500 }}>{s.l}</div>
                  </button>
                ))}
              </div>

              {/* Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: t.inputBg, border: `1px solid ${t.border0}`, minWidth: 220 }}>
                    <span style={{ color: t.text3, display: 'flex' }}>{I.search}</span>
                    <input type="text" placeholder="Search displays…" value={search} onChange={e => setSearch(e.target.value)} style={{ border: 'none', background: 'transparent', color: t.text0, fontSize: 14, outline: 'none', width: '100%', fontFamily: fontPrimary }} />
                  </div>
                  <select value={groupF} onChange={e => setGroupF(e.target.value)} style={{ padding: '9px 12px', borderRadius: 8, background: t.inputBg, border: `1px solid ${t.border0}`, color: t.text0, fontSize: 14, outline: 'none', fontFamily: fontPrimary, cursor: 'pointer' }}>
                    <option value="all">All Groups</option>
                    {mockGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${t.border0}` }}>
                    {[['grid', I.grid], ['list', I.list]].map(([v, ic]) => (
                      <button key={v} onClick={() => setViewMode(v)} style={{ padding: '8px 10px', border: 'none', background: viewMode === v ? t.accentDim : t.inputBg, color: viewMode === v ? t.accent : t.text3, cursor: 'pointer', display: 'flex' }}>{ic}</button>
                    ))}
                  </div>
                  <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg, ${vNavy}, ${t.accent})`, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                    {I.plus} Add Display
                  </button>
                </div>
              </div>

              {/* Grid / List */}
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '72px 24px' }}>
                  <div style={{ fontSize: 48, marginBottom: 16, opacity: .4 }}>📺</div>
                  <div style={{ fontSize: 18, fontWeight: 400, color: t.text1 }}>No displays match</div>
                  <div style={{ fontSize: 14, color: t.text2, marginTop: 8 }}>Adjust your filters or add a new display</div>
                </div>
              ) : viewMode === 'grid' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                  {filtered.map(d => <Card key={d.id} d={d} onClick={() => setSelected(d)} statusCfg={statusCfg} />)}
                </div>
              ) : (
                <div style={{ borderRadius: 12, border: `1px solid ${t.border0}`, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', padding: '10px 16px', fontSize: 12, color: t.text2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .8, borderBottom: `1px solid ${t.border0}`, background: t.bg2 }}>
                    <span style={{ flex: 2.5 }}>Display</span><span style={{ flex: 1 }}>Status</span><span style={{ flex: 1 }}>Hardware</span><span style={{ flex: 1 }}>Resolution</span><span style={{ flex: .8, textAlign: 'right' }}>Last Seen</span>
                  </div>
                  {filtered.map(d => {
                    const sc = statusCfg[d.status];
                    return (
                      <button key={d.id} className="row-h" onClick={() => setSelected(d)} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${t.border0}`, cursor: 'pointer', width: '100%', border: 'none', background: 'transparent', textAlign: 'left', color: t.text1 }}>
                        <div style={{ flex: 2.5, display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 16 }}>{hwIcon[d.hw]}</span>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 500, color: t.text0 }}>{d.name}</div>
                            <div style={{ fontSize: 13, color: t.text2, marginTop: 2 }}>{d.loc}</div>
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, padding: '3px 12px', borderRadius: 12, background: sc.bg, color: sc.c }}>{sc.label}</span>
                        </div>
                        <div style={{ flex: 1, fontSize: 14, color: t.text1 }}>{hwLabel[d.hw]}</div>
                        <div style={{ flex: 1, fontSize: 13, color: t.text1, fontFamily: fontMono }}>{d.w}×{d.h}</div>
                        <div style={{ flex: .8, fontSize: 13, color: t.text2, textAlign: 'right' }}>{timeAgo(d.hb)}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '96px 24px' }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: .3 }}>
                {page === 'media' ? '🖼️' : page === 'playlists' ? '▶️' : page === 'schedule' ? '📅' : page === 'provisioning' ? '⚙️' : page === 'alerts' ? '🔔' : '⚙️'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 400, color: t.text1 }}>{navItems.find(n => n.id === page)?.label}</div>
              <div style={{ fontSize: 14, color: t.text2, marginTop: 8 }}>Coming in the next build phase</div>
            </div>
          )}
        </main>
      </div>
    </div>
    </ThemeCtx.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DISPLAY CARD
// ═══════════════════════════════════════════════════════════════════════════

function Card({ d, onClick, statusCfg }) {
  const t = useTheme();
  const sc = statusCfg[d.status];
  const isP = d.orient === 'portrait';
  return (
    <button className="card-h" onClick={onClick} style={{
      borderRadius: 12, background: t.cardBg, border: `1px solid ${t.border0}`, overflow: 'hidden',
      cursor: 'pointer', textAlign: 'left', padding: 0, width: '100%', boxShadow: `0 1px 4px ${t.shadowColor}`,
    }}>
      <div style={{ position: 'relative', height: 115, background: `linear-gradient(160deg, ${t.bg0}, ${t.bg2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .04, backgroundImage: `linear-gradient(${t.accent} 1px, transparent 1px), linear-gradient(90deg, ${t.accent} 1px, transparent 1px)`, backgroundSize: '22px 22px' }} />
        <div style={{
          width: isP ? 38 : 76, height: isP ? 64 : 44,
          border: `1.5px solid ${t.border1}`, borderRadius: 4,
          background: d.status === 'online' ? `${t.green}10` : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {d.status === 'online' && <div style={{ width: '55%', height: '55%', borderRadius: 2, background: `linear-gradient(135deg, ${t.accent}18, ${t.green}18)` }} />}
        </div>
        <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: sc.bg, color: sc.c, display: 'flex', alignItems: 'center', gap: 6 }}>
          {d.status === 'online' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: 'pulse 2s ease infinite' }} />}
          {sc.label}
        </div>
        {isP && <div style={{ position: 'absolute', bottom: 10, left: 10, fontSize: 11, color: t.accent, fontWeight: 600, letterSpacing: 1 }}>PORTRAIT</div>}
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 15 }}>{hwIcon[d.hw]}</span>
          <span style={{ fontSize: 15, fontWeight: 500, color: t.text0 }}>{d.name}</span>
        </div>
        {d.loc && <div style={{ fontSize: 13, color: t.text2, marginTop: 4 }}>{d.loc}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 10, fontSize: 13, color: t.text2, alignItems: 'center' }}>
          <span style={{ fontFamily: fontMono, fontSize: 12 }}>{d.w}×{d.h}</span>
          {d.ip && <span style={{ fontFamily: fontMono, fontSize: 12, color: t.text3 }}>{d.ip}</span>}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: t.text2 }}>{timeAgo(d.hb)}</span>
        </div>
        {d.tags.length > 0 && <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
          {d.tags.map(tg => <span key={tg} style={{ fontSize: 12, padding: '3px 9px', borderRadius: 6, background: t.accentDim, color: t.accentText, fontWeight: 600 }}>{tg}</span>)}
        </div>}
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DETAIL VIEW
// ═══════════════════════════════════════════════════════════════════════════

function DetailView({ d, onBack, statusCfg }) {
  const t = useTheme();
  const sc = statusCfg[d.status];
  const tel = d.tel || {};

  const gauges = [
    { l: 'CPU', v: tel.cpu, u: '%', c: tel.cpu > 80 ? t.red : tel.cpu > 60 ? t.amber : t.green },
    { l: 'Temp', v: tel.temp, u: '°C', c: tel.temp > 70 ? t.red : tel.temp > 55 ? t.amber : t.green },
    { l: 'Memory', v: tel.mem, u: '%', c: tel.mem > 80 ? t.red : t.green },
    { l: 'Disk', v: tel.disk, u: '%', c: tel.disk > 85 ? t.red : tel.disk > 70 ? t.amber : t.green },
  ];

  return (
    <div style={{ animation: 'fadeIn .2s ease' }}>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: `1px solid ${t.border0}`, background: t.cardBg, color: t.text2, cursor: 'pointer', fontSize: 14, marginBottom: 20 }}>
        {I.back} All Displays
      </button>

      <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
        {/* Info panel */}
        <div style={{ flex: '1 1 440px', padding: 24, borderRadius: 12, background: t.cardBg, border: `1px solid ${t.border0}`, boxShadow: `0 2px 8px ${t.shadowColor}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <span style={{ fontSize: 32 }}>{hwIcon[d.hw]}</span>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 400, color: t.text0 }}>{d.name}</h2>
              {d.loc && <div style={{ fontSize: 14, color: t.text2, marginTop: 3 }}>{d.loc}</div>}
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, padding: '5px 14px', borderRadius: 14, background: sc.bg, color: sc.c, display: 'flex', alignItems: 'center', gap: 7 }}>
              {d.status === 'online' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', animation: 'pulse 2s ease infinite' }} />}
              {sc.label}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
            {[
              { l: 'Hardware', v: hwLabel[d.hw] },
              { l: 'Resolution', v: `${d.w}×${d.h}` },
              { l: 'Orientation', v: d.orient },
              { l: 'IP Address', v: d.ip || '—', mono: true },
              { l: 'Last Seen', v: timeAgo(d.hb) },
              { l: 'Group', v: mockGroups.find(g => g.id === d.gid)?.name || '—' },
            ].map(f => (
              <div key={f.l}>
                <div style={{ fontSize: 12, color: t.text2, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>{f.l}</div>
                <div style={{ color: t.text0, fontFamily: f.mono ? fontMono : 'inherit', fontSize: 15 }}>{f.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ flex: '0 0 190px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['Take Screenshot', 'Refresh Content', 'Restart Agent', 'Reboot Device'].map(a => (
            <button key={a} className="act-h" style={{
              padding: '11px 16px', borderRadius: 8, border: `1px solid ${t.border0}`, background: t.cardBg,
              color: t.text1, fontSize: 14, cursor: 'pointer', textAlign: 'left', boxShadow: `0 1px 3px ${t.shadowColor}`,
            }}>{a}</button>
          ))}
        </div>
      </div>

      {/* Telemetry gauges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
        {gauges.map(g => (
          <div key={g.l} style={{ padding: 20, borderRadius: 12, background: t.cardBg, border: `1px solid ${t.border0}`, boxShadow: `0 1px 4px ${t.shadowColor}` }}>
            <div style={{ fontSize: 12, color: t.text2, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontWeight: 600 }}>{g.l}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontSize: 34, fontWeight: 300, color: g.c }}>{g.v ?? '—'}</span>
              {g.v != null && <span style={{ fontSize: 16, color: t.text2 }}>{g.u}</span>}
            </div>
            {g.v != null && <div style={{ marginTop: 12, height: 4, borderRadius: 2, background: t.border0, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, g.v)}%`, height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${g.c}, ${g.c}cc)`, transition: 'width .4s ease' }} />
            </div>}
          </div>
        ))}
      </div>
    </div>
  );
}
