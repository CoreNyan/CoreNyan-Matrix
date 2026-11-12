import {showDialog,closeDialog,reveal} from './ui-motion.js';
import { termText, termHtml, termTextTemplate, termHtmlTemplate } from './terminology.js';
import { HEALTH, TELEMETRY, UI, TIMING } from './constants.js';

const percent = value => value != null && Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : null;
export function healthValues(payload) {
  const host = payload?.host || {}, life = payload?.vitals || {};
  const mood = percent(life.mood), energy = percent(life.energy);
  return {
    cpu: percent(host.cpuPercent), memory: percent(host.memPercent), disk: percent(host.diskPercent), mood, energy,
    curiosity: mood == null || energy == null ? null : Math.max(TELEMETRY.curiosityFloor,
      Math.min(100, Math.round(Math.round(mood) * TELEMETRY.moodWeight + Math.round(energy) * TELEMETRY.energyWeight)))
  };
}

export function recordHealthSample(history, payload, receivedAt = Date.now()) {
  if (!payload) return history;
  const time = Number(payload.timestamp) || receivedAt;
  if (history.length && time <= history.at(-1).time) return history;
  const oldest = time - HEALTH.historyLimit * TIMING.poll;
  return [...history.filter(sample => sample.time >= oldest).slice(-(HEALTH.historyLimit - 1)),
    { time, values: healthValues(payload), mode: payload.vitals?.mode || HEALTH.missing }];
}

const text = value => String(value ?? HEALTH.missing);
const pct = value => value == null ? HEALTH.missing : `${Number(value.toFixed(1))}%`;
const bytes = value => Number.isFinite(value) ? `${(value / 1024 ** 3).toFixed(2)} GiB` : HEALTH.missing;
const timeLabel = time => new Date(time).toLocaleTimeString(UI.locale, { hour12: false });
function element(tag, content, className) {
  const el = document.createElement(tag);
  if (content != null) el.textContent = content;
  if (className) el.className = className;
  return el;
}

export function mountHealthDetails(registry) {
  const dialog = document.createElement('dialog');
  dialog.id = 'healthDetailDialog'; dialog.className = 'health-detail-dialog';
  dialog.setAttribute('aria-labelledby', 'healthDetailTitle');
  dialog.innerHTML = termHtmlTemplate`<header class="health-detail-header"><div><span class="health-eyebrow">{{health.heading}} / DETAIL</span><h2 id="healthDetailTitle"></h2></div><button type="button" class="wire-action-btn" autofocus aria-label="关闭详情">关闭 ×</button></header><div class="health-detail-body"><div class="health-current"><strong id="healthDetailValue"></strong><span id="healthDetailStatus" role="status"></span></div><dl id="healthDetailFacts" class="health-facts"></dl><section class="health-history"><h3>变化轨迹 <span id="healthSampleCount"></span></h3><div id="healthDetailChart"></div><p id="healthHistoryNote"></p></section><section><h3>数值变更</h3><div class="health-change-scroll"><table class="health-changes"><thead><tr><th>时间</th><th>数值</th><th>变化</th><th>状态</th></tr></thead><tbody id="healthDetailChanges"></tbody></table></div></section><section><h3>近期活动 <small>上下文参考，不代表变化原因</small></h3><ul id="healthDetailLogs"></ul></section></div>`;
  document.body.append(dialog);
  const find = id => dialog.querySelector(`#${id}`);
  const close = () => { registry.state.healthDetail = null; };
  dialog.querySelector('button').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) {
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  } });
  document.querySelectorAll('[data-health-open]').forEach(button => button.addEventListener('click', () => {
    registry.state.healthDetail = button.dataset.healthOpen;
  }));
  const offSamples = registry.subscribe(['lastVitalsPayload'], state => {
    state.healthHistory = recordHealthSample(state.healthHistory, state.lastVitalsPayload);
  });
  const offRender = registry.subscribe(['healthDetail', 'healthHistory', 'telemetryError'], state => {
    const key = state.healthDetail;
    if (!key) { if (dialog.open) closeDialog(dialog); return; }
    const payload = state.lastVitalsPayload || {}, host = payload.host || {}, life = payload.vitals || {};
    const values = healthValues(payload), current = values[key];
    find('healthDetailTitle').textContent = HEALTH.titles[key];
    find('healthDetailValue').textContent = pct(current);
    find('healthDetailStatus').textContent = state.telemetryError ? `连接中断 · 保留最近采样：${state.telemetryError}` : `最近采样 ${payload.timestamp ? timeLabel(payload.timestamp) : '等待中'}`;
    const rows = [];
    if (key === 'cpu') rows.push(['CPU 型号', host.cpuModel], ['逻辑核心', host.cpuCores], ['主机', host.hostname], ['系统', host.platform], ['平均负载 / 1、5、15 分钟', /windows/i.test(host.platform || '') ? 'Windows 不提供此指标' : host.loadAvg?.join(' / ')]);
    if (key === 'memory' || key === 'disk') {
      const total = key === 'memory' ? host.memTotal : host.diskTotal;
      const used = key === 'memory' ? host.memUsed : host.diskUsed;
      rows.push(['总容量', bytes(total)], ['已用', bytes(used)], ['剩余', bytes(Number.isFinite(total) && Number.isFinite(used) ? Math.max(0, total - used) : null)]);
      rows.push(['采样范围', key === 'memory' ? termText("主机物理{{health.memory.zh}}；未提供各进程占用或{{health.memory.zh}}条型号") : '服务端采样卷；未提供全部分区及目录占用明细']);
    }
    if (['mood', 'energy', 'curiosity'].includes(key)) {
      rows.push(['当前状态', life.mode], ['最近心跳', life.lastHeartbeat ? new Date(life.lastHeartbeat).toLocaleString(UI.locale) : null]);
      if (key === 'curiosity') rows.push([termText("{{health.mood.zh}}贡献"), `${pct(values.mood)} × ${TELEMETRY.moodWeight}`], [termText("{{health.energy.zh}}贡献"), `${pct(values.energy)} × ${TELEMETRY.energyWeight}`], ['估算方法', `加权求和并取整，最低 ${TELEMETRY.curiosityFloor}%，最高 100%；不是独立传感指标`]);
      else rows.push(['数据来源', termText("后端{{concept.lifeState.zh}}；未提供历史变化原因")]);
    }
    const samples = state.healthHistory.filter(sample => sample.values[key] != null);
    if (samples.length) {
      const numbers = samples.map(sample => sample.values[key]);
      rows.push(['本页最低 / 最高', `${pct(Math.min(...numbers))} / ${pct(Math.max(...numbers))}`]);
    }
    find('healthDetailFacts').replaceChildren(...rows.flatMap(([name, value]) => [element('dt', name), element('dd', text(value))]));
    find('healthSampleCount').textContent = `${samples.length} 个采样点`;
    find('healthHistoryNote').textContent = HEALTH.historyNote;
    const chart = find('healthDetailChart');
    chart.replaceChildren();
    if (!samples.length) chart.append(element('p', '等待首个有效采样。'));
    else {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${HEALTH.chartWidth} ${HEALTH.chartHeight}`);
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', `${HEALTH.titles[key]}，0 到 100%，${samples.length} 个采样点`);
      const duration = samples.at(-1).time - samples[0].time;
      const points = samples.map(sample => [duration ? (sample.time - samples[0].time) / duration * (HEALTH.chartWidth - 16) + 8 : 8, 8 + (100 - sample.values[key]) / 100 * (HEALTH.chartHeight - 16)]);
      // Only numeric coordinates enter SVG markup; user-provided strings use textContent.
      svg.innerHTML = `<path d="M8 8H${HEALTH.chartWidth - 8}M8 ${HEALTH.chartHeight / 2}H${HEALTH.chartWidth - 8}M8 ${HEALTH.chartHeight - 8}H${HEALTH.chartWidth - 8}" class="health-chart-grid"/><polyline points="${points.map(point => point.join(',')).join(' ')}" class="health-chart-line"/><circle cx="${points.at(-1)[0]}" cy="${points.at(-1)[1]}" r="3" fill="currentColor"/>`;
      chart.append(svg, element('div', `${timeLabel(samples[0].time)} → ${timeLabel(samples.at(-1).time)} · 纵轴 0–100%`, 'health-chart-axis'));
    }
    const changes = samples.filter((sample, i) => i === 0 || sample.values[key] !== samples[i - 1].values[key]);
    find('healthDetailChanges').replaceChildren(...changes.slice(-HEALTH.changeLimit).reverse().map(sample => {
      const index = samples.indexOf(sample), previous = samples[index - 1];
      const difference = previous ? sample.values[key] - previous.values[key] : null;
      const row = element('tr');
      const delta = difference == null ? '首次采样' : `${difference > 0 ? '+' : ''}${Number(difference.toFixed(1))} 个百分点`;
      row.append(...[timeLabel(sample.time), pct(sample.values[key]), delta, sample.mode].map(value => element('td', value)));
      return row;
    }));
    const logs = Array.isArray(life.recentLogs) ? life.recentLogs.slice(-TELEMETRY.diaryEntries).reverse() : [];
    find('healthDetailLogs').replaceChildren(...(logs.length ? logs : ['暂无近期活动']).map(log => element('li', typeof log === 'string' ? log : log?.text || log?.msg || log?.summary || JSON.stringify(log))));
    showDialog(dialog);
  });
  return () => { offSamples(); offRender(); dialog.remove(); };
}
