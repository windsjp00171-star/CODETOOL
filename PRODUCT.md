# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static site, no build step. Plain HTML, CSS and native ES modules served over HTTP (GitHub Pages or similar). Opening `index.html` from disk via `file://` is not a requirement (confirmed 2026-11-21). Third-party libraries load from cdnjs: jsPDF, JSZip, qrcode-generator.

## Users

Office administrators, welfare-committee members, teachers and club organizers who run an event a few times a year (year-end party 尾牙, sports day, school fair) and need numbered tickets. They do not know print terminology (bleed, imposition, dpi) and use the tool rarely, so every session is close to a first session. Their main fear is printing 250 tickets wrong.

## Product Purpose

票券工作室 turns a ticket image plus a number range (or a name list) into a print-ready, numbered PDF, then runs the live prize draw for those same tickets. Success: the PDF prints at the right size on the first try, and on the night every drawn ticket is checked (in range, issued, not already won, verification code matches) and shown on a projector.

## Positioning

One tool covers both ends of a raffle: design-and-print the numbered tickets, then register and project the winners against exactly that print run. Because the draw knows the printed range, void list and per-ticket verification codes, it can reject tickets a generic randomizer or spreadsheet cannot.

## Operating Context

- Ticket making happens at a desk on a laptop or office PC, days before the event, often with a Canva export or a phone photo as the ticket image.
- Printing is either on an office printer (no bleed) or sent to a print shop (3 mm bleed).
- The draw happens live: one operator at a laptop types or scans drawn ticket numbers while a host calls winners. Sometimes a second window is dragged onto a projector in a dim hall; sometimes there is no projector and the tool is only the record that prevents duplicates.
- The event laptop is frequently not the laptop the tickets were designed on; the saved file (存成檔案) is how settings travel.

## Capabilities and Constraints

- Use-case presets: 摸彩券, 號碼牌, 入場券 (QR + verification code), 餐券／兌換券, 名牌／座位卡.
- Sequential numbering with zero-padding and exclusions, or one ticket per row of a pasted/CSV name list with `{欄位}` placeholders.
- Text and QR fields placed by dragging on a live single-ticket preview; `{n}` number, `{code}` verification code.
- Imposition on A4 / A3 / B4 / Letter with paper-saving auto layout (down to 90%), stack-cut ordering, crop marks, bleed handling.
- Output: PDF at chosen dpi, or a ZIP of single JPGs; verification-code CSV.
- Built-in ticket background generator (6 themes) and optional AI backgrounds using the user's own Gemini or OpenAI key; keys stay in the browser and never enter saved files.
- Draw: prize list with quotas, void list, verification check, manual/scanner/camera entry, random draw, no-show handling, projector window synced via BroadcastChannel, CSV export and printable winner list.
- All state lives in the browser's localStorage; nothing is uploaded except AI prompts to the chosen provider.
- Interface language: Traditional Chinese (zh-Hant), plain wording rather than print jargon.

## Brand Commitments

Name: 票券工作室. Voice: plain, reassuring, task-first Traditional Chinese; explain consequences ("印出來會變小") instead of terms.

## Evidence on Hand

No testimonials, usage numbers or customer names exist. Do not invent any.

## Product Principles

1. Getting a correct print on the first try outranks every other feature; warn before paper is wasted.
2. Show the default path in three steps; advanced controls stay reachable but never crowd a first-time user.
3. Explain with consequences and pictures, not print jargon.
4. On draw night, the operator must never be unsure whether a number was accepted.
5. The user's data stays in their browser.
