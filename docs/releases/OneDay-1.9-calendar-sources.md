# OneDay 1.9 calendar sources

## Mainland holiday arrangements

The calendar explicitly encodes the State Council General Office's published 2025 and 2026 nationwide holiday periods and makeup working days. It does not extrapolate arrangements for other years. A user-created calendar marker takes precedence over the official label for that date; ordinary weekends remain distinct from announced holidays.

- 2025: [国务院办公厅关于2025年部分节假日安排的通知](https://big5.www.gov.cn/gate/big5/www.gov.cn/zhengce/zhengceku/202411/content_6986383.htm), 国办发明电〔2024〕12号, 2024-11-12; [official reproduction](https://www.forestry.gov.cn/c/www/szxx/594663.jhtml).
- 2026: [国务院办公厅关于2026年部分节假日安排的通知](https://big5.www.gov.cn/gate/big5/www.gov.cn/zhengce/content/202511/content_7047090.htm), 国办发明电〔2025〕7号, 2025-11-04; [government reproduction](https://zwfw.gansu.gov.cn/huixian/zczx/tzgg/art/2025/art_715c16a75e4d4c289c295e77772c7274.html).

The labels describe the announced holiday *period*, including adjacent weekends and adjusted rest days; they do not imply that every date is a statutory paid holiday. They do not represent employer-specific schedules or personal leave.

## Lunar dates and solar terms

The 24 solar-term dates for 2025–2027 are transcribed from the Hong Kong Observatory's Gregorian–Lunar Calendar Conversion Tables: [2025](https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2025e.pdf), [2026](https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2026e.pdf), [2027](https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2027e.pdf). No solar-term date is guessed outside that range. The [HKO conversion table index](https://www.hko.gov.hk/en/gts/time/conversion.htm) explains that dates close to midnight may differ by a day due to calculation precision.

Lunar dates are computed by the browser's `Intl.DateTimeFormat` Chinese calendar in Asia/Shanghai, with Gregorian input anchored safely inside the requested local date. Where the calendar formatter or its parts are unsupported or invalid, the lunar label is omitted. Browser implementations and calendar data versions may differ; the HKO tables are the reference for the supported years. The display gives the solar term priority when both a term and lunar date occur; the accessible label and tooltip include both.

Execution water remains the union of actual logged execution time for the local day divided by eight hours and capped at 100%; planned durations are not used.
