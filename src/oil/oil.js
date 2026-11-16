/* Visual experiment only: original data, editing and drag controllers stay in charge. */
(function () {
  'use strict';
  const L = window.OneDayLite;
  const originalHeader = L.paintHeader;
  L.paintHeader = function () {
    originalHeader();
    document.body.dataset.oilView = L.UI.tab === 'notes' ? 'records' : L.UI.view;
    document.getElementById('viewSwitch').style.setProperty('--oil-tab-index',
      ['calendar', 'board', 'stats'].indexOf(L.UI.view));
  };

  // A phone has one full-width reading path. Bring a selected task into it.
  L.revealDaySelection = function (root) {
    if (!window.matchMedia('(max-width:760px)').matches) return;
    const columns = root.querySelector('.day-timeline-columns');
    const detail = columns?.querySelector('.day-detail-panel:not(.empty)');
    if (!detail) return;
    const top = detail.getBoundingClientRect().top - columns.getBoundingClientRect().top + columns.scrollTop;
    columns.scrollTo({top, behavior: window.matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth'});
  };
})();
