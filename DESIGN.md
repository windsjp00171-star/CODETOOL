---
name: 票券工作室
description: A print-shop proof sheet for numbered tickets and the live prize draw.
colors:
  paper: "#fbfcfc"
  paper-2: "#f0f3f3"
  paper-3: "#e3e8e8"
  rule: "#c5ced0"
  rule-strong: "#15181a"
  ink: "#15181a"
  ink-2: "#3b4246"
  ink-3: "#5c666b"
  rich-black: "#0b0d0e"
  magenta: "#d6006f"
  magenta-press: "#b0005b"
  magenta-tint: "#fde6f1"
  cyan: "#0089c4"
  cyan-ink: "#006a97"
  cyan-tint: "#e2f2f9"
  yellow: "#ffe500"
  yellow-tint: "#fff7bf"
  yellow-ink: "#5c4b00"
  ok: "#0a7a52"
  ok-tint: "#e1f3ea"
  danger: "#b4231a"
  danger-tint: "#fbe7e5"
  mat: "#2c6249"
  mat-2: "#24553e"
  mat-night: "#17271f"
  mat-night-2: "#10201a"
  mat-ink: "#e8f4ec"
  mat-ink-2: "#b9d4c4"
  ruler: "#f4f6f2"
  ruler-ink: "#1b1f21"
  log-sheet: "#dde3e1"
  process-cyan: "#00a0e0"
  process-magenta: "#e6007e"
typography:
  display:
    fontFamily: "Barlow Semi Condensed, Noto Sans TC, system-ui, sans-serif"
    fontSize: "clamp(64px, 12vw, 176px)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.02em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "clamp(22px, 3vw, 36px)"
    fontWeight: 800
    letterSpacing: "0.06em"
  title:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: "30px"
    letterSpacing: "0.02em"
  title-small:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 800
    letterSpacing: "0.02em"
  body:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  body-small:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.02em"
  count:
    fontFamily: "Barlow Semi Condensed, Noto Sans TC, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1.1
    fontFeature: "tnum"
rounded:
  stamp: "1px"
  sm: "2px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "18px"
  lg: "22px"
components:
  button-primary:
    backgroundColor: "{colors.magenta}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "7px 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.magenta-press}"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "7px 14px"
    height: "36px"
  button-quiet:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "7px 14px"
    height: "36px"
  button-quiet-hover:
    backgroundColor: "{colors.paper-2}"
  button-mat:
    backgroundColor: "{colors.mat-2}"
    textColor: "{colors.mat-ink}"
    rounded: "{rounded.sm}"
    padding: "7px 14px"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "6px 9px"
    height: "34px"
  chip:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "3px 11px"
    height: "28px"
  chip-on:
    backgroundColor: "{colors.magenta}"
    textColor: "#ffffff"
  tab:
    textColor: "#aab3b7"
    rounded: "{rounded.sm}"
    padding: "0 18px"
    height: "40px"
  tab-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  step-number:
    backgroundColor: "{colors.ink}"
    textColor: "#ffffff"
    rounded: "{rounded.stamp}"
    size: "30px"
  step-number-done:
    backgroundColor: "{colors.ok}"
  show-sheet:
    backgroundColor: "{colors.rich-black}"
    textColor: "#ffffff"
    padding: "40px 28px 46px"
---

# Design System: 票券工作室

## Overview

**Creative North Star: "The Print-Shop Proof" (印刷廠打樣單)**

Every screen says "this is what will come off the press". The workspace is a print-shop proof: a job ticket (工單) of cool white paper with ruled, boxed fields on the left, and on the right a green self-healing cutting mat (切割墊) with a millimetre grid, on which the ticket sits at true proportion with mm rulers on its top and left edges and crop marks at its corners. The ink is process black; process magenta marks selection and the one primary path; cyan is information and guides; process yellow is caution. A CMYK color bar runs under the ink-black masthead as the sheet's slug line, and a registration target is the mark.

The interface is dense but calm, because the people using it run an event a few times a year and every session is close to a first session. Forms read as a filled-in job ticket: tiny boxed labels over square fields, steps numbered in stamped black squares, thin rules between sections. On draw night (抽獎紀錄) the same proof language turns into a rich-black press sheet with registration targets on four sides and a CMYK bar along its foot, announcing each winner in a condensed numeral face. Motion is state change only (150 to 200 ms), except the winner pop and confetti on the projector.

The world rejects the generic SaaS editor: rounded white cards on grey, indigo buttons.

**Key Characteristics:**
- Two materials side by side: job-ticket paper (left, 392px) and the cutting mat (right, fills the rest).
- Square corners everywhere (2px, stamps 1px).
- Four process inks with fixed jobs: black for ink and structure, magenta for selection and the primary path, cyan for information and guides, yellow for caution.
- Print-trade marks as structure: CMYK slug, crop marks, mm rulers, registration targets.
- Numbers in tabular figures; the winner number and tallies in Barlow Semi Condensed.

## Colors

A press palette: cool white paper, process black ink, a green cutting mat, and the four process colors each holding one job.

### Primary
- **Process Magenta** (magenta): the selection and primary-path ink. The download button (下載 PDF), selected field outline on the proof, chosen option in segmented and fit choices, focus rings, checkbox accent, the active ruler tick and its mm readout, progress fill, `::selection`. Pressed and hover state is **Press Magenta** (magenta-press); selected surfaces take **Magenta Wash** (magenta-tint) with an inset 1px magenta line.

### Secondary
- **Guide Cyan** (cyan): non-printing guide lines (safe-area dashed line, unselected field dashed outline). **Cyan Ink** (cyan-ink) is the text and link form; **Cyan Wash** (cyan-tint) is the info note ground.
- **Process Yellow** (yellow): caution. The top bar of the move-tip on the draw mat, the prize name on the show sheet. **Yellow Wash** (yellow-tint) with **Yellow Ink** (yellow-ink) is the warning note.

### Tertiary
- **Proof Green** (ok): accepted. Completed step stamps, success messages (登記成功), the print-reminder heading. Paired with **Proof Green Wash** (ok-tint).
- **Reject Red** (danger): rejected tickets and destructive actions only, with **Reject Wash** (danger-tint).

### Neutral
- **Job-Ticket White** (paper): the left job sheet, dialogs, menus, the active tab plate. **Field Ground** (paper-2) and **Pressed Ground** (paper-3) for table heads, sub-forms, disabled and waiting states. Fields themselves are pure white.
- **Hairline** (rule) for thin rules and field strokes; **Box Rule** (rule-strong) for the heavy rule that frames boxes, tallies, dialogs and table heads.
- **Process Black** (ink) is text and the ink button; **ink-2** secondary text; **ink-3** hint text (5.6:1 on paper).
- **Rich Black** (rich-black): masthead, the draw show sheet, the projector window.
- **Cutting Mat Green** (mat) and **Mat Block** (mat-2): the preview surface. Grid lines are mat-ink at 10% (5 mm minor, every 20px) and 22% (major, every 100px). **Mat Ink** (mat-ink) and **Mat Ink Soft** (mat-ink-2) are text on the mat.
- **Night Mat** (mat-night, mat-night-2): the draw tab overrides the mat to this darker green so the black show sheet and the log stand out in a dim hall. Deliberate.
- **Ruler White** (ruler) with **Ruler Ink** (ruler-ink): the mm rulers.
- **Dimmed Log Sheet** (log-sheet): the winner log on the draw mat is a grey-green sheet, a step down from paper, so it reads as a record beneath the show, not a second hero. Deliberate.
- **Process Cyan / Process Magenta** (process-cyan, process-magenta): the literal print-bar inks, used only in the CMYK slug, the show-sheet foot bar, the favicon and the projector confetti (with yellow and white). They are not UI colors.

### Named Rules
**The Four Inks Rule.** Each process color has one job. Magenta selects and leads, cyan informs and guides, yellow cautions, black structures. A color never borrows another's job.

**The One Magenta Path Rule.** On any panel or dialog, exactly one filled magenta button exists: the action that produces the print (下載 PDF), 登記 on draw night, or a dialog's confirming action. Everything else is ink, quiet, or mat.

**The Slug Is Not a Palette Rule.** The CMYK bar colors are print marks. They appear as bars, confetti and the favicon, never as button, text or surface colors.

## Typography

**Display Font:** Barlow Semi Condensed 700/800 (Google Fonts, `text=0123456789/` digits subset), falling back to Noto Sans TC
**Body Font:** Noto Sans TC (with PingFang TC, Microsoft JhengHei, system-ui)

**Character:** A plain, sturdy zh-Hant sans for every word, and a condensed press numeral that only ever sets digits. Heavy weights (800) carry headings, like stamped job-ticket headers.

### Hierarchy
- **Display** (800, clamp(64px, 12vw, 176px), line-height 1, tabular): the winner number on the show sheet; 18vw fullscreen, 19vw in the projector window.
- **Headline** (800, clamp(22px, 3vw, 36px), 0.06em tracking): the prize name on the show sheet, in yellow.
- **Title** (800, 18px, line-height 30px): step headings in the three-step job ticket and dialog headings.
- **Title Small** (800, 16px): boxed section headings (完整設定 blocks, mat headings, log heading).
- **Body** (400, 14px, 1.55): controls and running text. **Body Small** (13px, 1.6) for notes, hints on the mat, secondary lines.
- **Label** (600, 12px, 0.02em): the tiny boxed labels above fields, tally captions, table heads.
- **Count** (Barlow Semi Condensed 800, 28px, tabular): the three tally cells.

### Named Rules
**The Digits-Only Display Rule.** Barlow Semi Condensed is loaded as a digits subset. It sets numbers (winner number, tallies, drawn-number list) and nothing else; any Chinese or Latin word in a numeral slot falls through to Noto Sans TC.

**The Tabular Figures Rule.** Every number that can change or be compared (ranges, counts, codes, step stamps, table columns) uses tabular figures.

## Layout

Two-material workspace: a 392px job-ticket column (`--sheet-w`) and the cutting mat filling the remaining width (`minmax(0, 1fr)`), under a sticky 56px rich-black masthead and a 6px CMYK slug. The job sheet has 22px side padding; sections are 18px tall rhythm (`padding: 18px 0`) separated by hairlines; the simple panel's steps are a 34px stamp column plus body. Field groups sit on a 10px grid gap; button rows on 8px.

On the design tab above 960px the mat is sticky and scrolls independently; in simple mode the proof is vertically centred on it. The proof frame is a grid with 22px rulers on the top and left; the ticket sits 18px inside, with crop marks 17px outside each corner. Proof and page preview cap at 1100px.

At 960px and below the workspace stacks: job sheet first on the design tab, the mat first on the draw tab (so the show and entry lead on a phone). At 640px the masthead drops the wordmark subtitle and button labels to icon-only 36px plates; the draw entry row stacks.

## Elevation & Depth

Physical, not decorative. Depth exists only where paper lies on the mat or is lifted off it; panels on the same sheet stay flat and are separated by rules. The contract's "crop marks instead of shadows" landed as crop marks framing the proof plus a real sheet shadow under the paper, because the ticket and page preview are paper lying on a mat.

### Shadow Vocabulary
- **Sheet on mat** (`box-shadow: 0 1px 2px rgba(0,0,0,.25), 0 8px 24px rgba(0,0,0,.28)`, `--shadow-sheet`): the ticket proof, the page preview canvas, generator preview, drop hint card.
- **Job sheet edge** (`box-shadow: 4px 0 18px rgba(0,0,0,.22)`; `0 4px 18px` when stacked): the left job ticket casting onto the mat.
- **Lifted tool** (`0 2px 4px rgba(0,0,0,.18), 0 16px 32px rgba(0,0,0,.28)` for the menu; `0 2px 4px rgba(0,0,0,.25), 0 8px 18px rgba(0,0,0,.3)` for the mini-bar): floating controls.
- **Dialog sheet** (`0 4px 8px rgba(0,0,0,.2), 0 24px 60px rgba(0,0,0,.4)`) over a rich-black 62% backdrop.
- **Inset rings** (`inset 0 0 0 1px` / `2px`): notes, selected options and messages draw their border as an inset ring, not an elevation.

### Named Rules
**The Paper-On-Mat Rule.** Shadows only appear under something that is a separate sheet over the mat or a tool lifted above it. Nothing on the job sheet itself casts a shadow.

## Shapes

Square-cut paper. Radius is 2px on fields, buttons, chips, tabs (top corners only), menus and dialogs, and 1px on the stamped step and section numbers. Boxes are drawn with rules: 1px hairlines for field strokes and section dividers, 1px box-rule black for tallies, dialog headings and table heads, 2px ink for the draw entry field, a dashed hairline to isolate destructive actions. Recurring print-trade geometry: L-shaped crop marks (12px arms, 3px offset) at proof corners, circular registration targets on the show sheet, the CMYK slug as a stepped bar.

## Components

### Buttons
Flat ink plates, square, firm.
- **Shape:** 2px corners, 36px tall (30px small, 44px for the download and 54px for 登記).
- **Primary:** magenta fill, white 600 text; only for the print path, the draw entry and a dialog's confirming action.
- **Ink:** process black fill for the first action of a step (選擇圖片).
- **Quiet:** white with a hairline stroke; hover turns the stroke ink and the ground paper-2. Danger variant keeps quiet styling with red text and a red-wash hover.
- **Ghost:** on the masthead, transparent with a 28% white stroke.
- **Mat:** on the cutting mat, mat-block fill with a soft mat-ink stroke.
- **Hover / Active:** 150ms color transitions; press nudges down 1px. Disabled is 45% opacity.

### Chips and Choices
- **Chips:** white, hairline stroke, 28px; on state is solid magenta with white text.
- **Fit options and segmented choices:** white rows with a hairline; the selected one takes magenta-tint ground with a magenta inset ring.

### Inputs / Fields
- **Style:** pure white, 1px hairline stroke, 2px corners, 34px tall, a 12px 600 label stacked 3px above (the boxed-field 欄位 of a job ticket).
- **Hover / Focus:** stroke darkens to ink-3; focus turns it magenta with a 1px magenta ring.
- **Disabled:** paper-2 ground, ink-3 text.
- **Draw entry:** 54px, 22px bold, 2px ink stroke, magenta 2px ring on focus; the field the operator never loses.

### Navigation
- **Masthead:** 56px rich black, registration-target mark in magenta, 800 wordmark, then two tab plates (印券設計, 抽獎紀錄). Inactive tabs are grey text on black; the active tab is a paper plate joining the sheet below. Utility actions sit right as ghost buttons opening a paper menu whose rows highlight with a 2px magenta inset left edge.

### Notes
Small ruled slips: warn (yellow wash), ok (green wash), info (cyan wash), each with a 1px inset ring and a dashed rule between paragraphs.

### Step Stamps
30px black squares (22px for section numbers) with white tabular numerals; a done step turns proof green and swaps its numeral for a check icon (200ms); a waiting step goes paper-3 with its body at 50% opacity.

### Proof on the Mat (signature)
The ticket at true proportion on white with the sheet shadow, mm rulers top and left (drawn in canvas, ruler-ink ticks, 9.5px labels), crop marks at its corners, bleed tinted magenta at 22%, trim a 1.5px magenta line, safe area a 1.5px dashed cyan line. Fields have a dashed cyan outline; the selected field a 2px magenta outline with a white halo and an ink mini-bar above it. Dragging moves magenta ticks along both rulers with a magenta mm readout.

### Show Sheet (signature, draw night)
A rich-black press sheet with four registration targets at the edges and an 8px CMYK bar at its foot. Prize name in yellow headline, winner number in the display numeral with a 600ms pop on reveal, name and verification code below. Fullscreen and the projector window scale everything in vw; the projector adds confetti in process cyan, process magenta, yellow and white.

### Tally and Log
- **Tally:** three cells boxed in a box-rule frame with hairline dividers, label over a count numeral.
- **Log:** the dimmed log sheet with a 3px ink top rule; table rows on hairlines, head on a 1.5px box rule, no-shows struck through, ok / absent badges.

## Do's and Don'ts

### Do:
- **Do** keep the two materials: paper (#fbfcfc family) for forms and decisions, the green mat for anything that previews the print.
- **Do** use magenta for the single primary path and for selection, cyan for guides and information, yellow for caution, black for structure (The Four Inks Rule).
- **Do** frame the proof with crop marks and mm rulers, and label fields with small 12px 600 labels over square white fields.
- **Do** keep corners at 2px (1px on stamps) and draw boxes with rules: hairline (#c5ced0) for dividers, box rule (#15181a) for frames.
- **Do** set every changing number in tabular figures, and winner numbers and tallies in Barlow Semi Condensed.
- **Do** keep state transitions at 150 to 200ms on `cubic-bezier(0.16, 1, 0.3, 1)`; reserve larger motion for the winner pop and confetti.
- **Do** darken the mat (#17271f) wherever the black show sheet must carry the room.

### Don't:
- **Don't** use rounded white cards on grey or indigo buttons; this is a proof sheet, not a SaaS editor.
- **Don't** use the CMYK slug colors (#00a0e0, #e6007e) as UI fills or text; they are print marks.
- **Don't** put more than one filled magenta button on a panel.
- **Don't** add shadows to elements that sit on the job sheet; only sheets on the mat and lifted tools cast them.
- **Don't** set words in Barlow Semi Condensed; it is loaded for digits only.
