---
version: 1
slug: "ticket-studio-index-html"
primary_target: "ticket-studio/index.html"
related_targets: []
---

# 票券工作室 workspace (印券設計 + 抽獎紀錄)

Scope: the whole app shell in `ticket-studio/`: header, the design view (three-step panel, full settings panel, single-ticket stage, page preview, generator dialog, print dialog) and the draw view (prize sheet, live entry, show panel, projector window, winner log).
Mode: Operate. Confirmed 2026-11-21: redesign of all views plus a code restructure; function, flow and copy stay.

Audience and task: first-time-every-time event organizers; design days before at a desk in office daylight; draw night in a dim hall, sometimes projected, sometimes not.
Constraints: function, data model, localStorage keys and saved-file format unchanged; zh-Hant copy kept; static hosting over HTTP, native ES modules, no build step.

## Direction contract

THESIS: The workspace is a print-shop proof: a job ticket on the left, the proof on a cutting mat on the right, so every screen says "this is what will come off the press". It refuses the generic SaaS editor (rounded white cards on grey, indigo buttons).

OWN-WORLD: Job-ticket paper (cool white, ruled boxed fields, tiny boxed labels, square corners) beside a green self-healing cutting mat with a mm grid. Ink is process black; selection and the primary path are process magenta; information cyan; caution process yellow. Crop marks frame panels instead of shadows; a CMYK color bar is the header's slug line; a registration target is the mark.

STORY: The organizer fills a three-box job ticket, sees the ticket at true proportion on the mat with mm rulers, downloads the PDF with the printing check. On draw night the same proof language turns into a rich-black press sheet that announces each winner.

FIRST VIEWPORT: Ink-black header with the CMYK slug and two tab plates. Left 380px job ticket, steps 1 to 3 as boxed sections numbered in stamped squares, magenta download button at the foot. Right: cutting mat filling the rest, mm rulers on top and left edges of the ticket, the ticket centered with crop marks at its corners, the selected number outlined in magenta with its X/Y read on the rulers.

FORM: 印刷廠打樣單 (print-shop proof sheet), position 1 on my ordered list, chosen as IMPECCABLE'S PICK over the rolled 叫號機; seed key 1a05fbc4.

Signature interaction: dragging a field moves magenta guide ticks along both rulers showing its position in mm. Motion: 150 to 200 ms state changes only; draw night keeps the winner pop and confetti.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

None.
