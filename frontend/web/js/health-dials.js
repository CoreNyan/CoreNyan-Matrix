import { escapeTerm } from './terminology.js';
import { HEALTH_DIALS, DIAL } from './constants.js';

export function mountHealthDials(container) {
  if (!container) return;
  container.innerHTML = HEALTH_DIALS.map(metric => `
    <figure class="health-dial" data-dial="${metric.key}">
      <button class="dial-open" type="button" data-health-open="${metric.key}" aria-label="查看 ${escapeTerm(metric.label)} 详情" aria-haspopup="dialog">
      <div class="dial-face" role="meter" aria-label="${escapeTerm(metric.label)}" aria-valuemin="0" aria-valuemax="100">
        <svg viewBox="0 0 160 160" fill="none" aria-hidden="true">
          <circle class="dial-sketch" cx="80" cy="80" r="72" />
          <circle class="dial-ticks" cx="80" cy="80" r="63" pathLength="100" />
          <path class="dial-track" d="M 40.4 119.6 A 56 56 0 1 1 119.6 119.6" pathLength="100" />
          <path class="dial-progress" d="M 40.4 119.6 A 56 56 0 1 1 119.6 119.6" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" />
          <g class="dial-icon" transform="translate(68 38)">${metric.icon}</g>
          <g class="dial-needle"><path d="M 80 136 L 80 130" /></g>
        </svg>
        <div class="dial-reading"><strong id="${metric.valueId}">--</strong><span>${escapeTerm(metric.unit)}</span></div>
      </div>
      <span class="dial-open-hint">查看详情 ↗</span></button>
      <figcaption><span class="dial-label">${escapeTerm(metric.label)}</span><span class="dial-detail" id="${metric.detailId}">${escapeTerm(metric.detail)}</span></figcaption>
    </figure>`).join('');
}

export function renderHealthDials(values) {
  for (const metric of HEALTH_DIALS) {
    const dial = document.querySelector(`[data-dial="${metric.key}"]`);
    if (!dial) continue;
    const raw = Number(values[metric.key]);
    const valid = values[metric.key] != null && Number.isFinite(raw);
    const value = valid ? Math.min(DIAL.max, Math.max(DIAL.min, raw)) : null;
    const face = dial.querySelector('.dial-face');
    if (valid) face.setAttribute('aria-valuenow', String(value));
    else face.removeAttribute('aria-valuenow');
    face.setAttribute('aria-valuetext', valid ? `${Math.round(value)}%` : '暂无数据');
    dial.querySelector('.dial-progress').style.strokeDashoffset = String(DIAL.max - (value ?? 0));
    dial.querySelector('.dial-needle').style.transform = `rotate(${DIAL.startAngle + (value ?? 0) / DIAL.max * DIAL.sweepAngle}deg)`;
    document.getElementById(metric.valueId).textContent = valid ? `${Math.round(value)}%` : '--';
  }
}
