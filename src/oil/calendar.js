/* Oil UI experiment: a date index paired with a readable, selected-day brief. */
(function () {
  'use strict';
  const L = window.OneDayLite;
  const { C, calendarMeta: meta } = L;
  const E = C.esc;
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const compactMarkers = { holiday: '休', workday: '班', weekend: '周', leave: '假', custom: '标' };

  function actualExecution(date, now) {
    const start = new Date(date + 'T00:00:00').getTime();
    const end = new Date(C.plusDays(date, 1) + 'T00:00:00').getTime();
    return C.summary(L.tasks(), L.store.data.logs, now, [start, end]).unique;
  }

  function briefTask(task, date) {
    const status = task['任务状态'];
    const range = C.timelineRange(task, date);
    const minute = value => String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
    const time = range.kind === 'all-day' ? '全天' : minute(range.start) + '–' + minute(range.end);
    return '<button class="oil-brief-task ' + L.statusClass(status) + '" data-act="day-timeline" data-date="' + E(date) + '" data-id="' + E(C.id(task)) + '">' +
      '<time class="oil-brief-time" datetime="' + E(date) + '">' + E(time) + (range.spans ? ' · 跨日' : '') + '</time>' +
      '<span class="oil-brief-title">' + E(task['任务标题']) + '</span>' +
      '<span class="oil-brief-state">' + L.icon(L.statusIcon(status), 13) + E(L.statusLabel(status)) + '</span>' +
      '</button>';
  }

  function dayBrief(rows, date, today, now) {
    const day = new Date(date + 'T12:00:00');
    const tasks = rows.filter(task => C.onDay(task, date)).sort((a, b) => {
      return C.timelineRange(a, date).start - C.timelineRange(b, date).start;
    });
    const completed = tasks.filter(task => task['任务状态'] === '完成').length;
    const execution = actualExecution(date, now);
    const label = date === today ? '今天' : '所选日期';
    const heading = '<header class="oil-brief-heading">' +
      '<div class="oil-brief-date"><span class="oil-brief-eyebrow">' + L.icon(date === today ? 'today' : 'calendar', 14) + label + '</span>' +
      '<h2><strong>' + String(day.getDate()).padStart(2, '0') + '</strong><span>' + weekdays[day.getDay()] + '<small>' + day.getFullYear() + '年 ' + (day.getMonth() + 1) + '月</small></span></h2></div>' +
      '<button class="icon-button oil-brief-open" data-act="day-timeline" data-date="' + E(date) + '" aria-label="打开 ' + E(date) + ' 单日时间轴" title="打开单日时间轴">' + L.icon('arrowRight', 20) + '</button>' +
      '</header>';
    const metrics = '<div class="oil-brief-metrics">' +
      '<span><strong>' + tasks.length + '</strong><small>项安排</small></span>' +
      '<span><strong>' + completed + '</strong><small>已完成</small></span>' +
      '<span class="oil-brief-execution" title="当天所有任务的实际执行时长，重叠时段已去重"><strong>' + E(C.duration(execution)) + '</strong><small>实际执行</small></span>' +
      '</div>';
    const list = tasks.length ? '<div class="oil-brief-list">' + tasks.slice(0, 6).map(task => briefTask(task, date)).join('') + '</div>' :
      '<div class="oil-brief-empty"><p>这一天，还没有安排。</p><button class="text-button" data-act="new-on-day" data-date="' + E(date) + '">' + L.icon('plus', 16) + '添加安排</button></div>';
    const action = tasks.length ? '<button class="oil-brief-all" data-act="day-timeline" data-date="' + E(date) + '">' +
      (tasks.length > 6 ? '查看全部 ' + tasks.length + ' 项' : '打开单日时间轴') + L.icon('arrowRight', 16) + '</button>' : '';
    return '<aside class="oil-day-brief" aria-label="' + E(date) + ' 任务摘要">' + heading + metrics + list + action + '</aside>';
  }

  L.renderCalendar = function (rows) {
    const date = L.UI.date;
    const today = C.localDay();
    const now = Date.now();
    const days = C.monthDays(date);
    const currentWeek = date.slice(0, 7) === today.slice(0, 7) ? Math.floor(days.indexOf(today) / 7) : -1;
    const weeks = days.length / 7;
    const weights = Array.from({ length: weeks }, (_, i) => i === currentWeek ? '3fr' : '1fr').join(' ');
    const mobileRows = Array.from({ length: weeks }, (_, i) => i === currentWeek ? '108px' : '48px').join(' ');
    const cells = days.map((cellDate, index) => {
      const tasks = rows.filter(task => C.onDay(task, cellDate));
      const execution = actualExecution(cellDate, now);
      const water = Math.max(0, Math.min(100, execution / (8 * 60 * 60 * 1000) * 100));
      const user = C.calendarLabel(cellDate, L.store.data.cal);
      const official = meta.holiday(cellDate);
      const label = user.kind !== 'none' && user.kind !== 'weekend' ? user : official || user;
      const term = meta.solarTerm(cellDate);
      const moon = meta.lunar(cellDate);
      const isCurrentWeek = currentWeek >= 0 && Math.floor(index / 7) === currentWeek;
      const maxCards = isCurrentWeek ? 2 : 1;
      const details = [label.text, term, moon].filter(Boolean).join(' · ');
      const classes = ['day', 'marker-' + label.kind,
        cellDate.slice(0, 7) !== date.slice(0, 7) ? 'other' : '',
        cellDate === date ? 'selected' : '', cellDate === today ? 'today' : '',
        cellDate < today ? 'past' : cellDate > today ? 'future' : '',
        isCurrentWeek ? 'current-week' : ''].filter(Boolean).join(' ');
      const marker = label.kind !== 'none' ? '<span class="day-marker ' + E(label.kind) + '" title="' + E(label.text) + '">' +
        '<span class="calendar-marker-full">' + E(label.text) + '</span><span class="calendar-marker-compact">' + E(compactMarkers[label.kind] || '') + '</span></span>' : '';
      const todayIcon = cellDate === today ? '<span class="calendar-today-icon" title="今天" aria-label="今天">' + L.icon('today', 12) + '</span>' : '';
      const titles = tasks.slice(0, maxCards).map(task => '<button class="cal-task ' + L.statusClass(task['任务状态']) + '" data-act="day-timeline" data-date="' + E(cellDate) + '" data-id="' + E(C.id(task)) + '" title="' + E(task['任务标题']) + '">' +
        '<i class="status-dot ' + L.statusClass(task['任务状态']) + '"></i><span class="task-name">' + E(task['任务标题']) + '</span></button>').join('');
      const count = tasks.length ? '<span class="oil-day-count" aria-hidden="true">' + tasks.length + '项</span>' : '';
      const more = tasks.length > maxCards ? '<button class="cal-more" data-act="day" data-date="' + E(cellDate) + '">+' + (tasks.length - maxCards) + '</button>' : '';
      return '<div class="' + classes + '" role="gridcell" tabindex="0" data-act="day" data-date="' + E(cellDate) + '" data-marker-kind="' + E(label.kind) + '" data-task-count="' + tasks.length + '" aria-selected="' + (cellDate === date) + '" aria-label="' + E(cellDate + '，' + details + '，' + tasks.length + ' 项任务，执行 ' + C.duration(execution)) + '" style="--water:' + water.toFixed(1) + '%">' +
        '<div class="day-water-fill" data-exec-ms="' + execution + '" title="执行 ' + E(C.duration(execution)) + '"></div>' +
        '<div class="day-heading">' + marker + todayIcon + '<span class="day-number">' + Number(cellDate.slice(8)) + '</span></div>' +
        '<div class="calendar-lunar" title="' + E([term, moon].filter(Boolean).join(' · ')) + '">' + E(term || moon) + '</div>' +
        (['holiday', 'workday'].includes(label.kind) ? '<div class="calendar-holiday-caption" aria-hidden="true">' + E(label.text) + '</div>' : '') +
        titles + more + count + '<div class="day-dots">' + tasks.slice(0, 3).map(task => '<i class="' + L.statusClass(task['任务状态']) + '"></i>').join('') + '</div></div>';
    }).join('');
    return '<div class="calendar-layout oil-calendar-layout"><section class="calendar-main">' +
      '<div class="weekdays">' + ['一', '二', '三', '四', '五', '六', '日'].map((day, i) => '<span class="' + (i > 4 ? 'weekend' : '') + '">周' + day + '</span>').join('') + '</div>' +
      '<div class="month-grid calendar-weighted" role="grid" aria-label="' + E(date.slice(0, 7)) + '月历" style="--weeks:' + weeks + ';--calendar-rows:' + weights + ';--oil-calendar-mobile-rows:' + mobileRows + '">' + cells + '</div></section>' +
      dayBrief(rows, date, today, now) + '</div>';
  };
})();
