import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchDashboardStatus, isApiEnabled, uploadInferenceVideo } from './api.js';
import { Icon } from './icons.jsx';

const CLASS_META = {
  EMPTY: {
    label: 'EMPTY',
    subtitle: 'No people detected',
    range: '0 people',
    level: 0,
    tone: 'slate',
    acState: 'OFF',
    temperature: null,
    icon: 'users',
  },
  LOW: {
    label: 'LOW',
    subtitle: 'Low classroom occupancy',
    range: '1–2 people',
    level: 1,
    tone: 'green',
    acState: 'OFF',
    temperature: null,
    icon: 'users',
  },
  MEDIUM: {
    label: 'MEDIUM',
    subtitle: 'Medium classroom occupancy',
    range: '3–9 people',
    level: 2,
    tone: 'blue',
    acState: 'ON',
    temperature: 24,
    icon: 'users',
  },
  HIGH: {
    label: 'HIGH',
    subtitle: 'High classroom occupancy',
    range: '10+ people',
    level: 3,
    tone: 'red',
    acState: 'ON',
    temperature: 20,
    icon: 'users',
  },
  JANITOR: {
    label: 'JANITOR',
    subtitle: 'Cleaning activity detected',
    range: 'Cleaning mode',
    level: 0.65,
    tone: 'purple',
    acState: 'OFF',
    temperature: null,
    icon: 'broom',
  },
};

const NAV_ITEMS = [
  ['Dashboard', 'dashboard', 'top'],
  ['Live Inference', 'camera', 'live-inference'],
  ['Analytics', 'analytics', 'analytics'],
  ['Events', 'calendar', 'recent-events'],
  ['Automation Rules', 'settings', 'automation-rules'],
  ['Devices', 'chip', 'system-status'],
  ['Settings', 'settings', null],
  ['Reports', 'report', null],
  ['Logs', 'list', null],
];

const LEVEL_LABELS = ['EMPTY', 'LOW', 'MEDIUM', 'HIGH'];
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const initialTimeline = [
  0, 0, 1, 1, 1, 2, 2, 1, 2, 2, 3, 3, 2, 2, 1, 2, 2, 3, 2, 2, 1, 2, 2,
].map((level, index) => ({
  level,
  time: new Date(Date.now() - (22 - index) * 5 * 60 * 1000),
}));

const initialAcHistory = initialTimeline.map((item) => ({
  on: item.level >= 2,
  time: item.time,
}));

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

function formatTime(dateLike) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getMeta(occupancy) {
  return CLASS_META[occupancy] || CLASS_META.EMPTY;
}

function classifyPersonCount(count, thresholds) {
  const people = Math.max(0, Number(count) || 0);
  if (people === 0) return 'EMPTY';
  if (people <= thresholds.lowMax) return 'LOW';
  if (people <= thresholds.mediumMax) return 'MEDIUM';
  return 'HIGH';
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [occupancy, setOccupancy] = useState('MEDIUM');
  const [personCount, setPersonCount] = useState(0);
  const [confidence, setConfidence] = useState(0.94);
  const [runtimeSeconds, setRuntimeSeconds] = useState(2 * 3600 + 18 * 60);
  const [timeline, setTimeline] = useState(initialTimeline);
  const [acHistory, setAcHistory] = useState(initialAcHistory);
  const [showOccupancyHistory, setShowOccupancyHistory] = useState(false);
  const [showAcHistory, setShowAcHistory] = useState(false);
  const [apiError, setApiError] = useState('');
  const [videoUpload, setVideoUpload] = useState({ busy: false, message: '' });
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [systemInfo, setSystemInfo] = useState({
    edgeConnected: true,
    cameraActive: true,
    modelName: 'Classroom Person Detector (YOLO11n ONNX)',
    deviceName: 'Local Edge Device',
    inferenceMs: 0,
    snapshotUrl: '',
    acState: 'OFF',
    temperature: null,
    rawOccupancy: 'EMPTY',
    controlPending: false,
    pendingSeconds: 0,
    controlReason: '',
  });
  const [toast, setToast] = useState('');
  const [thresholds, setThresholds] = useState({ lowMax: 2, mediumMax: 9 });
  const [manualAc, setManualAc] = useState(null);
  const [theme, setTheme] = useState(() => window.localStorage.getItem('dashboard-theme') || 'dark');

  useEffect(() => {
    window.localStorage.setItem('dashboard-theme', theme);
  }, [theme]);

  const displayOccupancy = manualAc === 'OFF' ? 'EMPTY' : occupancy;
  const displayPersonCount = manualAc === 'OFF' ? 0 : personCount;
  const meta = getMeta(displayOccupancy);
  const automaticAcState = isApiEnabled() ? systemInfo.acState : meta.acState;
  const acState = manualAc ?? automaticAcState;
  const automaticTemperature = isApiEnabled() ? systemInfo.temperature : meta.temperature;
  const controlledTemperature = manualAc === 'OFF'
    ? null
    : manualAc === 'ON'
      ? displayOccupancy === 'HIGH' ? 20 : 24
      : automaticTemperature;
  const acOn = acState === 'ON';
  const acStarting = manualAc == null && systemInfo.controlPending
    && acState === 'OFF'
    && (occupancy === 'MEDIUM' || occupancy === 'HIGH');

  const [events, setEvents] = useState([
    { id: 1, type: 'occupancy', text: 'Occupancy changed to MEDIUM', time: new Date(Date.now() - 5 * 60 * 1000) },
    { id: 2, type: 'ac-on', text: 'AC turned ON · set temperature to 24°C', time: new Date(Date.now() - 5 * 60 * 1000 - 5000) },
    { id: 3, type: 'occupancy', text: 'Occupancy changed to LOW', time: new Date(Date.now() - 82 * 60 * 1000) },
    { id: 4, type: 'ac-off', text: 'AC turned OFF · low occupancy', time: new Date(Date.now() - 82 * 60 * 1000 - 5000) },
    { id: 5, type: 'janitor', text: 'Cleaning activity detected', time: new Date(Date.now() - 3 * 60 * 60 * 1000) },
  ]);

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => setToast(''), 2600);
  }, []);

  const applyOccupancy = useCallback((nextOccupancy, nextConfidence = 0.9, sourceTime = new Date(), controlledAcOn = null) => {
    const normalized = CLASS_META[nextOccupancy] ? nextOccupancy : 'EMPTY';
    const previousMeta = getMeta(occupancy);
    const nextMeta = getMeta(normalized);

    setOccupancy(normalized);
    setConfidence(Math.max(0, Math.min(1, Number(nextConfidence) || 0)));
    setLastUpdated(sourceTime);
    const cutoff = sourceTime.getTime() - TWO_HOURS_MS;
    setTimeline((items) => {
      const retained = items.filter((item) => new Date(item.time).getTime() >= cutoff);
      const last = retained[retained.length - 1];
      const lastTime = last ? new Date(last.time).getTime() : 0;
      if (last && last.level === nextMeta.level && sourceTime.getTime() - lastTime < 5000) return retained;
      return [...retained, { level: nextMeta.level, time: sourceTime }];
    });
    setAcHistory((items) => {
      const retained = items.filter((item) => new Date(item.time).getTime() >= cutoff);
      const last = retained[retained.length - 1];
      const lastTime = last ? new Date(last.time).getTime() : 0;
      const nextOn = controlledAcOn ?? nextMeta.acState === 'ON';
      if (last && last.on === nextOn && sourceTime.getTime() - lastTime < 5000) return retained;
      return [...retained, { on: nextOn, time: sourceTime }];
    });

    if (normalized !== occupancy) {
      const newEvents = [{
        id: Date.now(),
        type: normalized === 'JANITOR' ? 'janitor' : 'occupancy',
        text: normalized === 'JANITOR' ? 'Cleaning activity detected' : `Occupancy changed to ${normalized}`,
        time: sourceTime,
      }];

      if (previousMeta.acState !== nextMeta.acState) {
        newEvents.push({
          id: Date.now() + 1,
          type: nextMeta.acState === 'ON' ? 'ac-on' : 'ac-off',
          text: nextMeta.acState === 'ON'
            ? `AC turned ON · set temperature to ${nextMeta.temperature}°C`
            : `AC turned OFF · ${normalized.toLowerCase()} mode`,
          time: sourceTime,
        });
      } else if (
        nextMeta.acState === 'ON'
        && previousMeta.temperature !== nextMeta.temperature
      ) {
        newEvents.push({
          id: Date.now() + 1,
          type: 'temperature',
          text: `AC temperature changed to ${nextMeta.temperature}°C`,
          time: sourceTime,
        });
      }

      setEvents((items) => [...newEvents, ...items].slice(0, 8));
    }
  }, [occupancy]);

  useEffect(() => {
    if (!acOn) return undefined;
    const timer = window.setInterval(() => {
      setRuntimeSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [acOn]);

  useEffect(() => {
    if (!isApiEnabled()) return undefined;

    const pollMs = Number(import.meta.env.VITE_API_POLL_MS || 3000);
    let active = true;
    let controller = new AbortController();

    const load = async () => {
      try {
        const status = await fetchDashboardStatus(controller.signal);
        if (!active) return;
        setApiError('');
        applyOccupancy(
          classifyPersonCount(status.personCount, thresholds),
          status.confidence,
          new Date(status.timestamp),
          status.acState === 'ON',
        );
        setPersonCount(status.personCount);
        if (manualAc !== 'OFF') setRuntimeSeconds(status.runtimeSeconds);
        setSystemInfo({
          edgeConnected: status.edgeConnected,
          cameraActive: status.cameraActive,
          modelName: status.modelName,
          deviceName: status.deviceName,
          inferenceMs: status.inferenceMs,
          snapshotUrl: status.snapshotUrl,
          acState: status.acState,
          temperature: status.temperature,
          rawOccupancy: status.rawOccupancy,
          controlPending: status.controlPending,
          pendingSeconds: status.pendingSeconds,
          controlReason: status.controlReason,
        });
      } catch (error) {
        if (error.name !== 'AbortError' && active) {
          setApiError('Backend unavailable — check VITE_API_BASE_URL.');
        }
      }
    };

    load();
    const timer = window.setInterval(() => {
      controller.abort();
      controller = new AbortController();
      load();
    }, pollMs);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [applyOccupancy, thresholds, manualAc]);

  const updateThreshold = (key, rawValue) => {
    if (rawValue === '') return;
    const value = Math.max(1, Math.min(99, Number(rawValue) || 1));
    setThresholds((current) => {
      if (key === 'lowMax') {
        return { lowMax: Math.min(value, current.mediumMax - 1), mediumMax: current.mediumMax };
      }
      if (key === 'highStart') {
        return { lowMax: current.lowMax, mediumMax: Math.max(value - 1, current.lowMax + 1) };
      }
      return { lowMax: current.lowMax, mediumMax: Math.max(value, current.lowMax + 1) };
    });
  };

  const changeManualAc = (value) => {
    setManualAc(value);
    showToast(value == null ? 'AC returned to automatic control.' : `Manual AC override: ${value}.`);
  };

  const handleNavigation = (label, target) => {
    if (target === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (target) {
      document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    showToast(`${label} is ready for your next project module.`);
  };

  const manualClassChange = (nextClass) => {
    if (isApiEnabled()) {
      showToast('Manual controls are disabled while API mode is active.');
      return;
    }
    applyOccupancy(nextClass, 0.96, new Date());
  };

  const handleVideoUpload = async (file) => {
    if (!file) return;
    setVideoUpload({ busy: true, message: `Uploading ${file.name}…` });
    try {
      await uploadInferenceVideo(file);
      setVideoUpload({ busy: false, message: `${file.name} is running through the detector.` });
      showToast('Video uploaded. Live person detection has started.');
    } catch (error) {
      setVideoUpload({ busy: false, message: error.message });
      showToast(error.message);
    }
  };

  const historyCutoff = lastUpdated.getTime() - TWO_HOURS_MS;
  const twoHourTimeline = timeline.filter((item) => new Date(item.time).getTime() >= historyCutoff);
  const twoHourAcHistory = acHistory.filter((item) => new Date(item.time).getTime() >= historyCutoff);
  const occupancyChartData = showOccupancyHistory ? twoHourTimeline : timeline.slice(-30);
  const acChartData = showAcHistory ? twoHourAcHistory : acHistory.slice(-30);

  return (
    <div className={`app-shell theme-${theme} ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <Header
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        apiMode={isApiEnabled()}
        apiError={apiError}
        onAction={showToast}
        acState={acState}
        manualAc={manualAc}
        onToggleAc={() => changeManualAc(acState === 'ON' ? 'OFF' : 'ON')}
        onAutoAc={() => changeManualAc(null)}
        theme={theme}
        onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
      />

      <Sidebar
        open={sidebarOpen}
        systemInfo={systemInfo}
        onNavigate={handleNavigation}
      />

      <main className="dashboard" id="top">
        {apiError && <div className="alert-banner">{apiError}</div>}

        <section className="metric-grid" aria-label="Current smart classroom metrics">
          <MetricCard
            title="Occupancy Level"
            value={meta.label}
            description={manualAc === 'OFF'
              ? 'Manual override · room treated as empty'
              : isApiEnabled()
              ? `${displayPersonCount} ${displayPersonCount === 1 ? 'person' : 'people'} detected · ${Math.round(confidence * 100)}% confidence`
              : `${meta.range} · ${Math.round(confidence * 100)}% confidence`}
            icon={meta.icon}
            tone={meta.tone}
            sparkline={[8, 11, 9, 14, 13, 18, 16, 22, 19, 24, 23, 28]}
          />
          <MetricCard
            title="AC State"
            value={acStarting ? 'STARTING' : acState}
            description={manualAc
              ? `Manual override · AC ${manualAc}`
              : systemInfo.controlPending
              ? `Protected change pending · ${systemInfo.pendingSeconds}s`
              : acOn ? 'Automated cooling is running' : 'Cooling is not required'}
            icon="power"
            tone={acOn ? 'green' : 'slate'}
            statusDot
          />
          <MetricCard
            title="Temperature"
            value={controlledTemperature == null ? '—' : `${controlledTemperature}°C`}
            description={manualAc === 'OFF'
              ? 'Temperature disabled by manual override'
              : systemInfo.controlPending
              ? systemInfo.controlReason
              : acOn ? 'Protected AC temperature setting' : 'No active temperature setting'}
            icon="thermometer"
            tone={controlledTemperature === 20 ? 'red' : 'blue'}
          />
          <MetricCard
            title="AC Running Time"
            value={formatDuration(runtimeSeconds)}
            description={manualAc === 'OFF' ? 'Paused by manual override' : 'Total runtime in this demo session'}
            icon="clock"
            tone="purple"
            sparkline={[3, 4, 4, 6, 5, 7, 6, 8, 8, 9, 11, 10]}
          />
        </section>

        <section className="analytics-grid" id="analytics">
          <Panel
            className="occupancy-panel"
            title="Occupancy Timeline"
            icon="users"
            action={showOccupancyHistory ? 'Live' : 'Last 2 Hours'}
            actionActive={showOccupancyHistory}
            onAction={() => setShowOccupancyHistory((shown) => !shown)}
          >
            <OccupancyChart data={occupancyChartData} thresholds={thresholds} />
          </Panel>

          <Panel
            className="ac-panel"
            title="AC Activity"
            icon="activity"
            action={showAcHistory ? 'Last 2 Hours' : 'Live'}
            actionActive={showAcHistory}
            onAction={() => setShowAcHistory((shown) => !shown)}
          >
            <AcActivityChart data={acChartData} />
          </Panel>

          <Panel className="rules-panel" id="automation-rules" title="Automation Rules" icon="shield">
            <AutomationRules
              current={displayOccupancy}
              thresholds={thresholds}
              onThresholdChange={updateThreshold}
              manualAc={manualAc}
              onManualAc={changeManualAc}
              onSelect={manualClassChange}
            />
          </Panel>
        </section>

        <section className="lower-grid">
          <Panel className="live-panel" id="live-inference" title="Live Inference" icon="camera" badge="LIVE">
            <LiveInference
              occupancy={displayOccupancy}
              personCount={displayPersonCount}
              confidence={confidence}
              systemInfo={systemInfo}
              lastUpdated={lastUpdated}
              videoUpload={videoUpload}
              onVideoUpload={handleVideoUpload}
            />
          </Panel>

          <Panel className="events-panel" id="recent-events" title="Recent Events" icon="list" action="View all">
            <RecentEvents events={events} />
          </Panel>

          <Panel className="status-panel" id="system-status" title="System Status" icon="monitor">
            <SystemStatus
              systemInfo={systemInfo}
              acOn={acOn}
              temperature={controlledTemperature}
              apiError={apiError}
            />
          </Panel>
        </section>

      </main>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Header({ onToggleSidebar, apiMode, apiError, onAction, acState, manualAc, onToggleAc, onAutoAc, theme, onToggleTheme }) {
  const [openMenu, setOpenMenu] = useState('');
  const actionsRef = useRef(null);

  useEffect(() => {
    const closeMenus = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && actionsRef.current?.contains(event.target)) return;
      setOpenMenu('');
    };
    document.addEventListener('pointerdown', closeMenus);
    document.addEventListener('keydown', closeMenus);
    return () => {
      document.removeEventListener('pointerdown', closeMenus);
      document.removeEventListener('keydown', closeMenus);
    };
  }, []);

  const goTo = (target, message) => {
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setOpenMenu('');
    if (message) onAction(message);
  };

  return (
    <header className="topbar">
      <div className="brand-zone">
        <button className="icon-button menu-button" type="button" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          <Icon name="menu" size={24} />
        </button>
        <div className="university-mark" aria-label="Smart University">
          <div className="crest"><Icon name="shield" size={29} /></div>
          <div><strong>Smart</strong><span>University</span></div>
        </div>
      </div>

      <div className="project-heading">
        <h1>Smart Classroom Edge AI System</h1>
        <p>Occupancy Detection <span>•</span> Person Counting <span>•</span> Automated AC Control</p>
      </div>

      <div className="topbar-actions" ref={actionsRef}>
        <button className="theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          <span>{theme === 'dark' ? 'LIGHT' : 'DARK'}</span>
        </button>
        <div className="header-ac-control">
          <span><small>{manualAc ? 'MANUAL AC' : 'AUTO AC'}</small><strong>{acState}</strong></span>
          <button type="button" className={`ac-power-switch ${acState === 'ON' ? 'is-on' : ''}`} onClick={onToggleAc} aria-label={`Turn AC ${acState === 'ON' ? 'off' : 'on'} manually`}>
            <Icon name="power" size={17} />
          </button>
          {manualAc && <button type="button" className="auto-reset" onClick={onAutoAc}>AUTO</button>}
        </div>
        <div className={`online-pill ${apiError ? 'offline' : ''}`}>
          <span className="pulse-dot" />
          {apiError ? 'Offline' : apiMode ? 'API Online' : 'Local Mode'}
        </div>

        <div className="header-menu-wrap notification-wrap">
          <button
            className="icon-button notification-button"
            type="button"
            aria-label="Notifications"
            aria-expanded={openMenu === 'notifications'}
            onClick={() => setOpenMenu((menu) => menu === 'notifications' ? '' : 'notifications')}
          >
            <Icon name="bell" size={21} />
            <span>3</span>
          </button>
          {openMenu === 'notifications' && (
            <div className="header-dropdown notification-dropdown" role="menu">
              <div className="dropdown-heading"><strong>Notifications</strong><small>3 recent</small></div>
              <button type="button" onClick={() => goTo('live-inference')}>
                <span className="dropdown-dot success" />
                <span><strong>Video inference active</strong><small>The classroom video is being processed.</small></span>
              </button>
              <button type="button" onClick={() => goTo('automation-rules')}>
                <span className="dropdown-dot danger" />
                <span><strong>Occupancy rule updated</strong><small>Cooling follows the current person count.</small></span>
              </button>
              <button type="button" onClick={() => goTo('system-status')}>
                <span className="dropdown-dot info" />
                <span><strong>Edge model online</strong><small>YOLO11n ONNX inference is connected.</small></span>
              </button>
              <button className="dropdown-footer" type="button" onClick={() => goTo('recent-events')}>
                View recent events
              </button>
            </div>
          )}
        </div>

        <div className="header-menu-wrap">
          <button
            className="admin-profile"
            type="button"
            aria-label="Open admin menu"
            aria-expanded={openMenu === 'admin'}
            onClick={() => setOpenMenu((menu) => menu === 'admin' ? '' : 'admin')}
          >
            <span className="avatar">A</span>
            <span>Admin</span>
            <span className={`caret ${openMenu === 'admin' ? 'open' : ''}`}>⌄</span>
          </button>
          {openMenu === 'admin' && (
            <div className="header-dropdown admin-dropdown" role="menu">
              <div className="admin-summary">
                <span className="avatar">A</span>
                <span><strong>Administrator</strong><small>Smart Classroom Control</small></span>
              </div>
              <button type="button" onClick={() => goTo('system-status', 'System status opened.')}>
                <Icon name="monitor" size={17} /> System status
              </button>
              <button type="button" onClick={() => goTo('automation-rules', 'Automation rules opened.')}>
                <Icon name="settings" size={17} /> Automation rules
              </button>
              <button type="button" onClick={() => goTo('live-inference', 'Live inference opened.')}>
                <Icon name="camera" size={17} /> Live inference
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function LegacyHeader({ sidebarOpen, onToggleSidebar, apiMode, apiError }) {
  return (
    <header className="topbar">
      <div className="brand-zone">
        <button className="icon-button menu-button" type="button" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          <Icon name="menu" size={24} />
        </button>
        <div className="university-mark" aria-label="Smart University">
          <div className="crest"><Icon name="shield" size={29} /></div>
          <div><strong>Smart</strong><span>University</span></div>
        </div>
      </div>

      <div className="project-heading">
        <h1>Smart Classroom Edge AI System</h1>
        <p>Occupancy Detection <span>•</span> Activity Simulation <span>•</span> Automated AC Control</p>
      </div>

      <div className="topbar-actions">
        <div className={`online-pill ${apiError ? 'offline' : ''}`}>
          <span className="pulse-dot" />
          {apiError ? 'Offline' : apiMode ? 'API Online' : 'Demo Online'}
        </div>
        <button className="icon-button notification-button" type="button" aria-label="Notifications">
          <Icon name="bell" size={21} />
          <span>3</span>
        </button>
        <div className="admin-profile">
          <div className="avatar">A</div>
          <span>Admin</span>
          <span className="caret">⌄</span>
        </div>
      </div>
    </header>
  );
}

function Sidebar({ open, systemInfo, onNavigate }) {
  return (
    <aside className="sidebar" aria-hidden={!open}>
      <nav className="navigation" aria-label="Dashboard navigation">
        {NAV_ITEMS.map(([label, icon, target], index) => (
          <button
            type="button"
            key={label}
            className={`nav-item ${index === 0 ? 'active' : ''}`}
            onClick={() => onNavigate(label, target)}
            title={!open ? label : undefined}
          >
            <Icon name={icon} size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="edge-summary">
        <h3>Edge Device Status</h3>
        <div className="edge-state"><span className="status-dot success" />Edge Device</div>
        <span className="connected-badge">Connected</span>
        <dl>
          <div><dt>Model</dt><dd>{systemInfo.modelName}</dd></div>
          <div><dt>Device</dt><dd>{systemInfo.deviceName}</dd></div>
          <div><dt>Privacy</dt><dd>Local inference</dd></div>
        </dl>
      </div>
    </aside>
  );
}

function MetricCard({ title, value, description, icon, tone, sparkline, statusDot }) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-icon"><Icon name={icon} size={30} /></div>
      <div className="metric-content">
        <div className="metric-title-row">
          <h2>{title}</h2>
          {statusDot && <span className="status-dot success" />}
        </div>
        <strong className="metric-value">{value}</strong>
        <p>{description}</p>
        {sparkline && <Sparkline values={sparkline} />}
      </div>
    </article>
  );
}

function Sparkline({ values }) {
  const width = 220;
  const height = 34;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / Math.max(1, max - min)) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Recent trend">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}

function Panel({ title, icon, action, actionActive = false, onAction, badge, className = '', id, children }) {
  return (
    <section className={`panel ${className}`} id={id}>
      <div className="panel-header">
        <div className="panel-title"><Icon name={icon} size={20} /><h2>{title}</h2></div>
        {action && (
          <button
            className={`panel-action ${actionActive ? 'active' : ''}`}
            type="button"
            onClick={onAction}
            aria-pressed={actionActive}
          >
            {action}
          </button>
        )}
        {badge && <span className="live-badge">{badge}</span>}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

function OccupancyChart({ data, thresholds }) {
  const width = 760;
  const height = 270;
  const plot = { left: 82, right: 22, top: 20, bottom: 45 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const yForLevel = (level) => plot.top + plotHeight - (level / 3) * plotHeight;
  const points = data.map((item, index) => {
    const x = plot.left + (index / Math.max(1, data.length - 1)) * plotWidth;
    return `${x},${yForLevel(item.level)}`;
  }).join(' ');
  const area = `${plot.left},${plot.top + plotHeight} ${points} ${plot.left + plotWidth},${plot.top + plotHeight}`;
  const xLabels = [data[0], data[Math.floor(data.length / 2)], data[data.length - 1]].filter(Boolean);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Occupancy class timeline">
        <defs>
          <linearGradient id="occupancyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1473e6" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#1473e6" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3].map((level) => (
          <g key={level}>
            <line
              x1={plot.left}
              x2={plot.left + plotWidth}
              y1={yForLevel(level)}
              y2={yForLevel(level)}
              className={`grid-line level-${level}`}
            />
            <text x={plot.left - 14} y={yForLevel(level) + 5} textAnchor="end" className="axis-label">
              {LEVEL_LABELS[level]}
            </text>
          </g>
        ))}

        <polygon points={area} fill="url(#occupancyFill)" />
        <polyline points={points} fill="none" stroke="#1269db" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {data.length > 0 && (() => {
          const last = data[data.length - 1];
          return <circle cx={plot.left + plotWidth} cy={yForLevel(last.level)} r="5" fill="#1269db" stroke="#fff" strokeWidth="3" />;
        })()}

        {xLabels.map((item, index) => {
          const sourceIndex = data.indexOf(item);
          const x = plot.left + (sourceIndex / Math.max(1, data.length - 1)) * plotWidth;
          return <text key={`${item.time}-${index}`} x={x} y={height - 12} textAnchor={index === 0 ? 'start' : index === 2 ? 'end' : 'middle'} className="axis-label">{formatTime(item.time).slice(0, 5)}</text>;
        })}
      </svg>
      <div className="chart-legend">
        <span><i className="legend-dot empty" />EMPTY</span>
        <span><i className="legend-dot low" />LOW (1–{thresholds.lowMax})</span>
        <span><i className="legend-dot medium" />MEDIUM ({thresholds.lowMax + 1}–{thresholds.mediumMax})</span>
        <span><i className="legend-dot high" />HIGH ({thresholds.mediumMax + 1}+)</span>
      </div>
    </div>
  );
}

function AcActivityChart({ data }) {
  const width = 420;
  const height = 270;
  const left = 56;
  const right = 20;
  const top = 34;
  const bottom = 52;
  const plotWidth = width - left - right;
  const onY = 78;
  const offY = 194;
  const firstTime = data[0]?.time;
  const lastTime = data[data.length - 1]?.time;
  const path = data.reduce((segments, item, index) => {
    const x = left + (index / Math.max(1, data.length - 1)) * plotWidth;
    const y = item.on ? onY : offY;
    if (index === 0) return `M ${x} ${y}`;
    return `${segments} H ${x} V ${y}`;
  }, '');

  return (
    <div className="chart-wrap ac-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="AC on and off activity timeline">
        <rect x={left} y={top} width={plotWidth} height={offY - top + 14} rx="10" fill="#f9fbfe" />
        <line x1={left} x2={left + plotWidth} y1={onY} y2={onY} className="grid-line" />
        <line x1={left} x2={left + plotWidth} y1={offY} y2={offY} className="grid-line" />
        <text x={left - 12} y={onY + 4} textAnchor="end" className="axis-label">ON</text>
        <text x={left - 12} y={offY + 4} textAnchor="end" className="axis-label">OFF</text>
        <path d={path} fill="none" stroke="#22a65a" strokeWidth="4" strokeLinejoin="round" />
        <text x={left} y={height - 18} className="axis-label">
          {firstTime ? formatTime(firstTime).slice(0, 5) : 'Earlier'}
        </text>
        <text x={left + plotWidth} y={height - 18} textAnchor="end" className="axis-label">
          {lastTime ? formatTime(lastTime).slice(0, 5) : 'Now'}
        </text>
      </svg>
      <div className="ac-legend"><span><i className="line-key on" />ON</span><span><i className="line-key off" />OFF</span></div>
    </div>
  );
}

function AutomationRules({ current, thresholds, onThresholdChange, manualAc, onManualAc, onSelect }) {
  const rules = [
    ['EMPTY', 'Exactly 0 people', 'AC OFF', 'slate'],
    ['LOW', `1–${thresholds.lowMax} people`, 'AC OFF', 'green'],
    ['MEDIUM', `${thresholds.lowMax + 1}–${thresholds.mediumMax} people`, 'AC ON · 24°C', 'blue'],
    ['HIGH', `${thresholds.mediumMax + 1}+ people`, 'AC ON · 20°C', 'red'],
  ];

  return (
    <div className="automation-editor">
      <div className="threshold-editor">
        <div className="editor-heading"><strong>People thresholds</strong><span>Changes apply instantly</span></div>
        <label>LOW maximum<input type="number" min="1" max={thresholds.mediumMax - 1} value={thresholds.lowMax} onChange={(event) => onThresholdChange('lowMax', event.target.value)} /></label>
        <label>MEDIUM maximum<input type="number" min={thresholds.lowMax + 1} max="99" value={thresholds.mediumMax} onChange={(event) => onThresholdChange('mediumMax', event.target.value)} /></label>
        <label>HIGH starts at<input type="number" min={thresholds.lowMax + 2} max="100" value={thresholds.mediumMax + 1} onChange={(event) => onThresholdChange('highStart', event.target.value)} /></label>
      </div>
      <div className="rule-list">
        {rules.map(([name, range, action, tone]) => (
          <button type="button" className={`rule-item tone-${tone} ${current === name ? 'selected' : ''}`} key={name} onClick={() => onSelect(name)}>
            <span className="rule-icon"><Icon name="users" size={20} /></span>
            <span className="rule-copy"><strong>{name} <small>→</small> {action}</strong><em>{range}</em></span>
            {current === name && <span className="active-check">✓</span>}
          </button>
        ))}
      </div>
      <div className="manual-control-card">
        <div><strong>Manual AC override</strong><span>Take control at any time</span></div>
        <div className="control-segments">
          <button type="button" className={manualAc == null ? 'active' : ''} onClick={() => onManualAc(null)}>AUTO</button>
          <button type="button" className={manualAc === 'OFF' ? 'active off' : ''} onClick={() => onManualAc('OFF')}>OFF</button>
          <button type="button" className={manualAc === 'ON' ? 'active on' : ''} onClick={() => onManualAc('ON')}>ON</button>
        </div>
        <p><span className={`status-dot ${manualAc ? 'danger' : 'success'}`} />{manualAc ? `Manual mode · AC ${manualAc}` : 'Automation is active'}</p>
      </div>
    </div>
  );
}

function LiveInference({
  occupancy,
  personCount,
  confidence,
  systemInfo,
  lastUpdated,
  videoUpload,
  onVideoUpload,
}) {
  const meta = getMeta(occupancy);
  return (
    <div className="live-layout">
      <div className="classroom-feed">
        {systemInfo.cameraActive && systemInfo.snapshotUrl && (
          <img
            className="inference-frame"
            src={systemInfo.snapshotUrl}
            alt="Uploaded classroom video with person detections"
          />
        )}
        <div className="room-ceiling"><span /><span /><span /><span /></div>
        <div className="room-front"><div className="screen">EDGE AI</div><div className="board" /></div>
        <div className="desk-row row-one"><Desk /><Desk /><Desk /></div>
        <div className="desk-row row-two"><Desk /><Desk /><Desk /><Desk /></div>
        <div className="feed-overlay top-left"><span className="record-dot" /> LIVE CAMERA</div>
        <div className={`prediction-overlay tone-${meta.tone}`}>
          <strong>{meta.label}</strong>
          <span>{Math.round(confidence * 100)}% confidence</span>
        </div>
        <div className="privacy-overlay"><Icon name="shield" size={15} /> Faces not stored</div>
      </div>

      <div className="inference-details">
        <div className="inference-callout">
          <span className="callout-icon"><Icon name="chip" size={22} /></span>
          <div><strong>Inference running locally</strong><p>Video stays on the edge device</p></div>
        </div>
        <label className={`video-upload ${videoUpload.busy ? 'is-busy' : ''}`}>
          <Icon name="camera" size={18} />
          <span>{videoUpload.busy ? 'Uploading video…' : 'Upload classroom video'}</span>
          <input
            type="file"
            accept="video/mp4,video/avi,video/quicktime,video/x-matroska,video/webm,.m4v"
            disabled={videoUpload.busy}
            onChange={(event) => {
              onVideoUpload(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>
        {videoUpload.message && <p className="video-upload-status">{videoUpload.message}</p>}
        <dl className="detail-list">
          <div><dt>Model</dt><dd>{systemInfo.modelName}</dd></div>
          <div><dt>Device</dt><dd>{systemInfo.deviceName}</dd></div>
          <div><dt>Input</dt><dd>Classroom video frame</dd></div>
          <div><dt>People</dt><dd>{personCount}</dd></div>
          <div><dt>Output</dt><dd>{occupancy} · {Math.round(confidence * 100)}%</dd></div>
          <div><dt>Inference</dt><dd>{systemInfo.inferenceMs || 0} ms</dd></div>
          <div><dt>Updated</dt><dd>{formatTime(lastUpdated)}</dd></div>
        </dl>
      </div>
    </div>
  );
}

function Desk() {
  return (
    <div className="desk-unit">
      <span className="student-head" />
      <span className="student-body" />
      <span className="desk-top" />
      <span className="chair-back" />
    </div>
  );
}

function RecentEvents({ events }) {
  const iconByType = {
    occupancy: ['users', 'blue'],
    'ac-on': ['power', 'green'],
    'ac-off': ['power', 'red'],
    temperature: ['thermometer', 'purple'],
    janitor: ['broom', 'orange'],
  };

  return (
    <div className="event-list">
      {events.slice(0, 6).map((event) => {
        const [icon, tone] = iconByType[event.type] || ['activity', 'blue'];
        return (
          <div className="event-row" key={event.id}>
            <span className={`event-icon tone-${tone}`}><Icon name={icon} size={17} /></span>
            <p>{event.text}</p>
            <time>{formatTime(event.time)}</time>
          </div>
        );
      })}
      <footer className="events-footer"><span><Icon name="calendar" size={15} /> {new Date().toLocaleDateString()}</span><span>Local time</span></footer>
    </div>
  );
}

function SystemStatus({ systemInfo, acOn, temperature, apiError }) {
  const rows = [
    ['Edge Device', systemInfo.edgeConnected && !apiError ? 'Connected' : 'Disconnected', 'chip', systemInfo.edgeConnected && !apiError],
    ['AI Inference', apiError ? 'Waiting' : 'Running', 'spark', !apiError],
    ['Camera', systemInfo.cameraActive ? 'Active' : 'Inactive', 'camera', systemInfo.cameraActive],
    [
      'AC Controller',
      systemInfo.controlPending
        ? `Protected · ${systemInfo.pendingSeconds}s`
        : acOn ? 'Cooling' : 'Standby',
      'settings',
      true,
    ],
    ['Temperature', temperature == null ? '—' : `${temperature}°C`, 'thermometer', true],
  ];

  return (
    <div className="status-list">
      {rows.map(([label, value, icon, healthy]) => (
        <div className="status-row" key={label}>
          <span className="status-row-icon"><Icon name={icon} size={18} /></span>
          <strong>{label}</strong>
          <em className={healthy ? 'healthy' : 'unhealthy'}>{value}</em>
          <span className={`status-dot ${healthy ? 'success' : 'danger'}`} />
        </div>
      ))}
    </div>
  );
}

export default App;
