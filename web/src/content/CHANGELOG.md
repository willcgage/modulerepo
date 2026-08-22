# Changelog

All notable changes to the Module Repository, newest first.
Headings are `version — date` (YYYY-MM-DD).

---

## v0.87.0 — 2026-08-22

### Changed
- **A siding or spur no longer reports a car capacity — an industry does.** The number a track showed was worked out from how far it ran *along the module*, which on a curved module is not the same as how much rail is actually there: on the inside of a bend it claimed more room than the track has, and on the outside less. Capacity belongs to the rail you have assigned to an industry, so that is where the car count now lives. A track still shows its usable length.

  ⓘ **Any capacity you have already recorded is left exactly as you entered it.** Nothing rewrites or deletes it; it simply is not shown against the track any more.

---

## v0.86.0 — 2026-08-18

### Fixed
- **A track the rebuild says it could not lay is no longer built anyway.** The panel that offers to rebuild a module as pieces lists any track it could not fit, and then laid the opening and closing curves of those tracks regardless — so what you were handed did not match what you had just been shown. On FMN-0003 an 18″ siding came back as a 9″ spur, with a second stub of track beside it that appears in no document at all. Track that cannot be laid is now left out altogether, and the turnouts that open it are reported plainly as leading nowhere.

---

## v0.85.1 — 2026-08-17

### Fixed
- **A hand-drawn second main is left where you drew it when rebuilding as pieces.** v0.85.0 laid it alongside the first main instead of along its own drawn line, which put its pieces somewhere the track does not go and left them reported as not connected. A Main 2 you have drawn is now treated the same as any other track you have drawn by hand.

---

## v0.85.0 — 2026-08-17

### Fixed
- **Rebuilding a curved or multi-board module as pieces now lays the track where it actually runs.** Until now the rebuild laid every piece along the module's straight axis, so on a board that curves — or one made of several sections that turn — the pieces came out somewhere the track never went. They now follow the module's own centre-line, and a siding or spur sits on its own side of it.

  ⓘ A track you have drawn a path for by hand is unchanged for now: those pieces still lay straight, and getting them onto the drawn line is the next step.

---

## v0.84.0 — 2026-08-15

### Fixed
- **A track you have drawn now records where its own rail begins, rather than where the turnout that opens it sits.** Those are two different places — about 1½ to 2 inches apart, the reach of the turnout — so a siding or spur has been storing a start, an end and a length that disagree with the line drawn on the board. The dispatcher reads those stored numbers rather than the drawing, which is why the same siding could appear in one place on the track plan and another in the dispatcher's view.

  Each drawn track re-reads its start and end from its own line the next time the module is saved, and its capacity is re-measured from those ends.

  ⓘ Only tracks you have drawn a path for — a track positioned by numbers alone is untouched, and nothing changes on a module until it is saved.

---

## v0.83.0 — 2026-08-07

### Fixed
- **The first run of track on a blank module now starts exactly at the endplate.** Laying the first piece had nothing to snap to, so the run began wherever the pointer happened to be — usually a fraction of an inch off the plate it has to join. Nothing corrected it afterwards, because every later piece snaps to the first, so the whole module ended up offset by that amount. Starting within reach of an endplate now anchors the run to that plate's track point and squares it up to the face.

  ⓘ Only when you start near an endplate. A run laid across the middle of the board is left exactly where you drew it.

---

## v0.82.0 — 2026-08-07

### Added
- **Removing something now tells you what else it affects, before you do it.** Removing a track says which turnouts and endplates it will disconnect; removing a branch endplate says that the track it carries goes with it, and names that track. The note appears on the Remove button and in the right-click menu.

  ⓘ **"Disconnects" is not "deletes".** Removing a track leaves every turnout and endplate in place — only the link between them is cleared, and you can re-point it. The only removal that takes a second object with it is a branch endplate, which owns the track running to it; that one says so by name.

  ⓘ No confirmation box. Everything here is undoable with Ctrl+Z, and a dialog on every delete would interrupt the ordinary case to guard the rare one.

---

## v0.81.0 — 2026-08-07

### Changed
- **The turnout panel now asks about the turnout before asking what it feeds.** Working down the fields, you used to reach the diverging-track choice — and "＋ New spur", which jumps you into editing that new track — before you had said which way the turnout throws, what frog number it is, or which part it is. The order is now Name, frog position, hand, turnout #, part, and then the track it diverges to. Reported by Steve Branton.

  ⓘ Nothing was removed and no module changes. Creating a spur or siding straight from the dropdown still works exactly as before; it is simply the last thing you are asked, once the turnout itself is described.

---

## v0.80.2 — 2026-08-07

### Fixed
- **The turnout icons in the parts palette were mirrored.** A left-hand turnout was drawn diverging to the right and a right-hand one to the left, so the picture you picked from disagreed with the turnout you got. Curved turnouts had the same fault. Reported by Steve Branton.

  ⓘ Only the icons were wrong. Turnouts already on your modules are drawn correctly and are unchanged — nothing needs re-entering.

---

## v0.80.1 — 2026-08-07

### Fixed
- **The right-click menu was describing the thing you selected *before*.** Right-clicking a turnout while an endplate was selected picked up the turnout correctly, but the menu still showed the endplate's message — so it could refuse to remove something that was perfectly removable, and give a reason that had nothing to do with what you clicked. It now always describes what is actually selected.

  ⓘ Removing was never affected: the menu's Remove always acted on the right object. It was the wording and the greying-out that were one step behind.

---

## v0.80.0 — 2026-08-07

### Added
- **Right-click anything on the board to remove it.** Removal is finally part of the drawing, rather than something you had to find at the foot of a panel or already know the key for. Right-clicking selects whatever is under the pointer and offers **Remove**.

  ⓘ When something can't be removed — endplates A and B, the mainline, a length of flex — the menu says so, and why, instead of offering an action that would do nothing.

  ⓘ Right-clicking never drags, draws, or starts a selection box, so opening the menu can't move or create anything by accident.

---

## v0.79.0 — 2026-08-07

### Added
- **Every Remove button now shows its keyboard shortcut.** `Remove turnout` reads `Remove turnout ⌫Del`, so the gesture that already works on everything is finally something you can discover instead of having to know.

  ⓘ Nothing on the drawing itself changed. A delete control sitting on the board is easy to hit by accident while you're editing, so the shortcut is taught where removal already happens — on the button you're about to press.

---

## v0.78.1 — 2026-08-07

### Fixed
- **"No track laid yet" is now actually on screen.** v0.78.0 added that note to the Track group, but the group starts closed when it holds nothing — so on a module with no track the advice sat behind a disclosure nobody had a reason to open. The Track group now opens when it has only that note to show.

---

## v0.78.0 — 2026-08-07

### Fixed
- **A module with no track laid no longer lists a mainline it hasn't got.** If you haven't laid any track, the Track group used to show a `Main` worked out from the module's length, together with a list of flex lengths to cut it from — a run you never built and a shopping list you couldn't use. It now says there's no track yet and points you at the Track tool.
- **A module built from pieces lists those pieces.** Your actual track — each piece named for the part it is, with its length — is now in the Track group and selectable there, instead of being reachable only by clicking it on the board.

  ⓘ Modules drawn the older way are unchanged: their Main 1 and Main 2 stay listed, selectable and editable exactly as before. This is the correction promised in v0.77.0.

---

## v0.77.0 — 2026-08-07

### Changed
- **A new module no longer records its shape as "straight" before you've said so.** Creating a module used to write "straight" into the geometry field on your behalf. It's now left blank until you choose, and the Geometry field is where you set it.

  ⓘ Modules created before this are untouched, and one with the field already blank still draws exactly as it did.

### Under the hood
- **A module built from track pieces stops working out a mainline it was never given.** Nothing on screen changes today — the drawing already ignored that invented line — but it was still being calculated, and anything added later would have quietly picked it up and drawn in the wrong place. It is gone at the source now.

  ⚠️ **Correction.** This entry first said the invented main would stop being *listed* under Track. That was wrong: a module with no track laid still shows a `Main` row with flex pieces, because that row is built from the module's own length rather than from the line this release removed. Removing it is a separate change and is being tracked on its own.

---

## v0.76.0 — 2026-08-07

### Changed
- **A length of flex can never be longer than the product it is cut from.** Ask for 50″ of a 30″ flex and you now get a 30″ and a 20″ — the two lengths you would actually lay — instead of one piece nobody sells. Shrinking is unchanged: you can always cut more off.
- **The longest length is the one your product comes in**, not a fixed 30″. Atlas Code 55 is 30″, Micro Engineering is 36″, and the piece panel says which.

  ⓘ Only the piece you resize and the one next to it are affected — a length elsewhere in the run that is already over-length is left exactly as it is, and stays flagged, rather than being quietly re-cut.

---

## v0.75.0 — 2026-08-07

### Fixed
- **Delete now removes whatever you have selected.** The key only ever worked on track pieces, so on a turnout, a crossing, a route, an industry, a control point or a benchwork corner it silently did nothing — which reads as not being able to delete anything at all. Select it and press Delete or Backspace; multi-selected pieces still all go together.
- **When something can't be deleted, the app says why.** Pressing Delete on endplate A or B explains that they are part of the benchwork and where the module joins its neighbours; on the mainline, that it is part of the module's structure. Previously the key did nothing and gave no reason, which is indistinguishable from a bug.

  ⓘ Removing a branch endplate still takes its diverging track with it, and removing a track still clears the turnouts and branch endplates that pointed at it — the Remove buttons and the Delete key now run exactly the same code, so they cannot behave differently.

---

## v0.74.0 — 2026-08-06

### Added
- **The app now tells you which layer you are working in, from what you have selected.** Select a benchwork corner and it says Benchwork; select a turnout and it says Trackwork. You never set it — it follows the selection, shown above the name of whatever you are editing.

  ⓘ It is a readout, not a switch. Selecting something tells you where you are; it does not change what your next click on the canvas will draw.

### Changed
- **The tool rail reads in the same build order, and each drawing tool shows its layer.** Benchwork, Track, Signal and Industry are layers 1 to 4 — the same four the Objects list and the layer readout use, numbered the same way. Select sits apart, because it creates nothing.

  ⓘ The tools still work exactly as before. Picking one still says what your next click on the canvas draws; nothing about that changed.
- **The Objects list now reads in build order.** Benchwork first (the board and the endplates that are part of it), then Trackwork (track, turnouts, crossings), then Control points, then Industries — the order you actually build a module in, with each layer named. It used to be grouped by object kind with no through-line.
- **A run no longer lists every length of flex it is cut from.** Most owners do not need to see that their main is three pieces, so the breakdown folds into a single "3 pieces" line you can open when you do.

  ⓘ A run containing a piece longer than its stock stays open and cannot be folded away, so a warning can never be hidden behind a closed section.

---

## v0.73.0 — 2026-08-06

### Added
- **The Objects list now shows your benchwork board by board.** If your module is built from sections, the Benchwork group lists each board and — once you have given one a shape — its corners, exactly as a single-board module has always listed its own. Selecting a corner opens it with editable X and Y, and switches the drawing to that board so the corner you picked is the corner under your pointer.
- **Each board can be shaped straight from the Objects list**, with "Shape this board" beside its name. A board you have not shaped yet says its shape is derived from its length, rather than looking like it has none.

### Fixed
- **A sectioned module no longer offers to "Draw the benchwork".** On a module built from two or more boards, the boards are the benchwork, so anything drawn as a single module-wide outline was quietly discarded — you could place corners, save, and never see them again. That offer is gone, replaced by the per-board shaping above.
- **A corner belongs to the board it was drawn on.** Corners were identified by their number alone, so board 2's "Corner 1" and board 1's "Corner 1" were treated as the same point.

  ⓘ Correction to the v0.72.0 note above: it said sections could not yet be given a shape. That was wrong — they could, from the Sections list, and had been able to since before that release. What was missing is what this release adds: the Benchwork group knowing about it.

---

## v0.72.0 — 2026-08-01

### Added
- **An endplate can now sit on a section's edge, not just the module's.** Your sections are pieces of your benchwork, so a module built from several boards can put an endplate on whichever board actually carries it. Each section's edges are listed alongside the module's, named after the section.

### Fixed
- **"Which edge of the benchwork is this?" now says why it is empty.** It used to sit greyed out with a single dead option, which reads as broken. It now tells you what to do — draw the board, or give a section a shape — depending on which is missing.

  ⚠️ A module whose benchwork lives entirely in sections still has no edges to offer, because sections cannot yet be given a shape. That is the next piece of work; this release makes the app say so plainly instead of leaving you guessing.

---

## v0.71.0 — 2026-08-01

### Fixed
- **Putting an endplate on a benchwork edge no longer stretches it to fill that edge.** Assigning an endplate to an edge used to widen it to the whole fascia and discard the face width you had set — so a 24″ endplate on a 96″ side became a 96″ endplate.

  An endplate is part of the benchwork, but it is not the whole of the edge it sits on. It keeps the width you gave it, placed where it already was. This is true of every endplate — there is no difference between A, B and the ones you add.

- **The face width now moves the plate along its edge.** Change the width of an endplate that belongs to an edge and the plate resizes on the board, instead of the number in the box quietly disagreeing with what is drawn.

---

## v0.70.0 — 2026-08-01

### Changed
- **Once both your endplates belong to a benchwork edge, your module's length comes from the board.** The Footprint length reads *(from the benchwork)* and is measured across your actual boardwork — endplate A's face to endplate B's — rather than typed in.

  This is what finishes the endplate work. The length used to decide where endplate B sat, while dragging endplate B set the length — each defining the other. Now the board says how long it is and the endplates are part of the board, so there is one answer instead of two.

  **It only happens once you have told the app which edges are your endplates.** Until then nothing changes and the length stays yours to type.

  It is measured **end to end**, not along a side — a tapered module whose fasciae run 96.3″ between ends 96″ apart is a 96″ module, because 96″ is what its neighbours meet.

- **If the board and the record disagree, you are told and neither is changed.** Move the board's ends if the record is right, or update the record if the board is. The app does not decide for you.

---

## v0.69.0 — 2026-08-01

### Added
- **Your board's maximum size, both ways, on the drawing and in the panel.** The module panel now reads *"Board, at its widest: 96″ left to right × 32″ top to bottom"*, and the depth callout on the drawing gained the same feet reading the length already had.

  They are **maximums** on purpose. A tapered module has no single depth — it might be 16″ at one end and 32″ at the other — and the number worth knowing is the most it needs, whether you are planning a layout or fitting it in a car.

### Fixed
- **The dimensions now measure your board, not your drawing.** They were taken from everything on the canvas, including track — so a spur running past a fascia made the module report a bigger board than you built. The benchwork's size is a fact about the benchwork.

  If a module has no benchwork drawn, the figures come from its dimensions and the panel says so.

---

## v0.68.0 — 2026-08-01

### Changed
- **Your endplates are now part of your benchwork.** Where an endplate already sits on an edge of your board, that edge owns it: the plate's position, its facing and its face are read off the board, so reshaping the board moves the plate with it. The endplate panel says which edge a plate belongs to.

  **You do not have to set this up.** If the plate already sat on an edge, the app works out which one. If you have deliberately placed a plate by hand, your placement still wins — and if you have named an edge yourself, that wins over everything.

  Binding never widens a plate to fill its edge: it keeps the face width you set. A deeper board does not make a wider endplate.

  Six modules will draw an endplate up to 0.56″ from where it was, because the plate sat slightly off the board and has now been pulled onto it. Nothing was saved or changed in any module — only the drawing.

### Added
- **A warning when an endplate is not on your benchwork.** If the board and the plate disagree about where the module ends, the app says so and moves nothing. Reshape the board to meet the plate, or move the plate onto an edge — your choice, not the app's.

---

## v0.67.0 — 2026-08-01

### Changed
- **Your benchwork is shaped by your board, not by the track you drew on it.** Drawing or moving the mainline used to reshape the module's footprint, and the endplates with it. The board is now shaped by your dimensions, sections and outline alone. Nothing you have positioned moves — turnouts, signals and industries still follow the mainline you drew.

### Added
- **A module with no benchwork now says so.** Half the catalogue has never had a board drawn, and until now the app quietly showed a shape derived from the dimensions that looked exactly like a real one. An endplate is part of the benchwork, so the endplate panel now tells you when there is no benchwork for it to be part of, and points you at the Benchwork tool.

  **Nothing was changed in your module, and no board stopped being drawn.** It is a note, not a correction — if the derived shape is right for your module, drawing it makes that explicit rather than assumed.

### Fixed
- **The note about a mainline not meeting its endplate now says which way it misses.** It read "stops 3.17″ from this endplate" whether the track fell short or ran past. It now says "runs 3.17″ past" or "stops 3.17″ short of", and the advice matches.

---

## v0.66.1 — 2026-08-01

### Fixed
- **You can drag endplate B again on a module with a drawn mainline.** v0.66.0 correctly stopped the track from dragging the endplate around — but on a module whose drawn mainline doesn't finish exactly at its end, that left endplate B's own handle stuck: pulling it six inches moved it nine thousandths of an inch.

  The handle sets your module's length, and it was measuring against your module's *current* length — so it could never report a position past the end it was trying to move. That only ever worked because the endplate used to sit wherever the track stopped. Now it measures where you actually dragged to.

  Endplate A is still fixed at the origin, as it has always been: everything on the board is measured from it.

---

## v0.66.0 — 2026-08-01

### Fixed
- **Moving your mainline no longer moves your endplate.** If you had drawn a mainline, dragging its end dragged the endplate along with it — so adjusting where the track ran quietly changed where the module said its end was.

  An endplate is the module's own fact. It sits where your dimensions, your pose, or the benchwork edge you bound it to put it, and nothing you do to the track moves it. To move an endplate, move the endplate.

  Nothing was ever wrong in your saved module — the endplate was only ever *drawn* in the wrong place, and no stored endplate was changed by this. Two test modules will look different because their drawn mainline stops short of their board; every other module is unaffected.

### Added
- **A note when your drawn mainline doesn't reach an endplate.** Instead of moving the plate to meet the track, the endplate panel now tells you how far short the track stops, and leaves both choices open: pull the mainline back onto the plate, or move the plate on purpose if the board really does end there.

---

## v0.65.0 — 2026-08-01

### Added
- **Pick up several pieces of track at once and move them together.** Shift-click pieces to build a selection, or hold Shift and drag a box across the board to gather everything inside it. Dragging any one of them then moves the whole set, keeping the spacing between them exactly as you laid it.

  Everything still moves independently by default — nothing is tied to anything else. A group only exists while you have it selected, and it moves only because you picked those pieces together.

  A group dropped on the board stays exactly where you put it: it does not snap onto nearby track. Joining a piece to a joint is still a single-piece gesture, so moving a run into place can never quietly re-position track you had already set.

  The panel for a multiple selection lists what you have picked, lets you shift them all by a typed number of inches, and can remove them all at once — as does the Delete key.

---

## v0.64.2 — 2026-08-01

### Changed
- **Rebuilding a curved module as pieces is withheld again, for now.** v0.64.0 let the rebuild lay pieces along track that doesn't run down the middle of a module — the right goal — but the geometry it produced was wrong: pieces landed off the board entirely, and one came out longer than the whole module. Rather than leave a rebuild that quietly makes a mess, the previous behaviour is back: a module whose mainline is drawn with bends says so and declines, which is honest.

  No module was changed by this. The work is not abandoned — it needs the positions handed to it in the same frame the drawing uses, which is being sorted out.

---

## v0.63.3 — 2026-08-01

### Fixed
- **The parts palette no longer squeezes the board out of existence.** Arming the Turnout kind lists three dozen products, and that bar took as much height as it wanted — leaving the board about 80 pixels tall, which is why it was being worked at 1355% zoom. The bar is now bounded and scrolls on its own, and the board keeps the rest of the space.

---

## v0.63.2 — 2026-08-01

### Fixed
- **The middle of the schematic builder scrolls.** Pick the Turnout kind and the parts palette prints three dozen products; that, the board and the dispatcher preview together are taller than a laptop screen. The board was being squeezed to a sliver and everything below it was simply out of reach, with no way to scroll to it. The column scrolls now, and the board keeps a minimum height so a tall palette can't crush it.

---

## v0.63.1 — 2026-08-01

### Fixed
- **The siding end handle can actually be grabbed.** It came back in v0.63.0 but was drawn underneath the turnout markers, and the turnout nearest it is only a few inches away — so pressing on the siding's end picked up the turnout instead. The handle was there and behaved exactly as though it wasn't.

  The end you're joining to a turnout is by definition right next to that turnout, so the two overlap precisely when the gesture matters. The end handles now draw on top.

---

## v0.63.0 — 2026-08-01

### Fixed
- **A passing siding can be dragged onto its turnouts again.** Its end handles had been taken away on the reasoning that a siding "is pinned to its two turnouts, so move those instead". Nothing pinned it: moving a turnout moved only the turnout, so a siding that didn't already meet its legs could never be made to. FMN-0064 sat with its siding ending 3″ short at one end and 2″ at the other, selectable and immovable.

  The handles are back, and an end dragged near a turnout now **snaps onto where its diverging route actually begins** — past the frog, where the rails have cleared and the siding proper starts. The readout says which turnout it landed on. The turnout itself doesn't move; it's positioned by its frog.

---

## v0.62.2 — 2026-08-01

### Changed
- **The MSS fields explain what they are.** "Crossover" and "Cascade" were offered as bare words, so a module reading "MSS: Yes" beside a board with no signals looked like something had gone wrong. It hadn't: a crossover module passes the signal bus through without signalling itself, and having no signals is exactly right for it. Of the 22 modules that declare MSS, 13 are crossovers and every one of them correctly carries no signals.

  The checkbox now says this is a fact about the module's wiring — which is why it lives on the module's details and not on the board. Nothing in a track plan can confirm or contradict how a module is wired.

---

## v0.62.1 — 2026-08-01

### Fixed
- **A turnout the document says nothing about now reads "Not recorded" instead of "#6".** Most of them say nothing — 35 of the 50 turnouts on record — and the box was showing a frog number as though someone had chosen it.

  The part that made it more than a wrong label: because the box already showed #6, choosing #6 changed nothing and saved nothing, so **a turnout that really is a #6 could never be recorded as one**. The single value you could not set was the one it claimed to have.

  Not recorded is now its own entry in the list, and picking it again clears a size you no longer want to assert. The board still draws an unrecorded turnout as a #6, because it has to draw something — but it no longer says that is what you told it.

---

## v0.62.0 — 2026-08-01

### Added
- **Mainline length is a field on the board.** How far the rail runs, when that differs from how long the board is — an end-of-line module whose track stops short, a curve whose main is shorter than its footprint. Leave it blank and the main runs the whole board, which is what most modules do.

  This number decides what every position on the canvas is measured along, and until now it could be set **nowhere**: two save paths wrote it and neither had a box to type it in. Six modules carry a value, so on those six the Footprint length field appeared to do nothing — the board is measured along the mainline, and while a mainline was set the footprint was a number nothing read.

### Changed
- **The Footprint length help text says what it is** — the physical length of the board, end to end — instead of telling you to draw the mainline if the rail runs a different distance. There is a field for that now.

---

## v0.61.1 — 2026-08-01

### Fixed
- **A module's endplate count is read from its board everywhere it appears.** It was a tally kept behind the scenes, and it disagreed with the board in both directions: a module with a third endplate placed on it still said two, while others said one or three or four for ends their board had never had. Seven modules were showing a wrong number — in your module list, in the catalogue, and in what Free-Dispatcher imports.

  On one module the tally had even drifted from the records it was counting, saying four where two existed. It counted up and down as records came and went rather than ever recounting, so a correction made outside the app left it stranded.

---

## v0.61.0 — 2026-08-01

### Added
- **You can name an endplate on the board.** Click an end and there's a Name box — a town, a railroad, a compass point. Leave it blank and it reads West and East as it always has.

  This is the field that made the change below possible. Naming an end *looked* available before, on the module page, but the name never survived: the schematic wrote "West" and "East" into the module every time it saved, straight over whatever had been typed. Eleven modules are carrying a name that could not stick.

### Changed
- **The module page no longer has Endplates, Tracks or Industries sections.** All three are built on the board now, where you can see what you're changing — an endplate is placed on a fascia, an industry is a length of track cars actually stand on. The module page keeps what it is good at: the two views of the module, its photographs, and its CAD drawings.

- **Creating a module is one path now.** The detailed wizard is gone — its offer was to enter endplates, tracks and industries up front, and those are the three things that moved onto the board. A module made that way arrived with endplates that had no position on any board and industries the first save of the schematic would remove. Name it, say what kind it is and how long the first board runs, and you are drawing. Everything else is still editable: name, description, category and MSS on the module's Edit page, geometry and lengths in the builder.

  The rule behind it: **if the board owns something, the module page must not offer to edit it.** Every field that broke that rule was a silent-revert bug waiting to be found, and two of them were found — one owner set both ends to single track, watched it change, and watched it come back; an industry added on the module page was deleted by the next save of the board.

- **The Edit page no longer sets the module's shape or length.** Those four fields — geometry, degrees, offset and footprint length — already existed on the board, in a better form: the board knows when a module is built from sections, so it steps aside for their shapes and stops you editing a length that is the sum of them. The Edit page's copy knew about sections for the shape and not for the length, so a length typed there on a sectioned module was quietly ignored. It keeps the things a board cannot tell you: name, description, category and MSS.

- **The endplate count on a module page is counted from the board.** It used to be a tally of rows kept behind the scenes, which drifted both ways: a module with a third endplate placed on the board still said two, while another said three long after its document knew of only two.

### Fixed
- **The single/double choice on an endplate is no longer greyed out for a reason that stopped being true.** The board could disable that choice, and the mainline single/double buttons with it, saying it was *"set on the module's endplate records"* — pointing at a page that no longer offers it. The lock had in fact been switched off for some time; what was left was the machinery and the message. Both are gone.
- **An endplate's name now reaches the catalogue.** The name shown on the board and the name the catalogue and Free-Dispatcher read are the same name, saved together.

---

## v0.60.0 — 2026-07-31

### Added
- **A Fast Tracks #6 turnout now draws its body and its rail joints.** Will measured his own build — tie end to point tips, 1.19″ — and with Fast Tracks' published overall length already on file, that one reading is enough for the board to say where the part physically starts and stops. A #6 gets its tie strip, and a rail joint at each end of the moulding on the through route.

  ⚠️ It still won't cut the flex around it. That needs one more reading — tie end to the **apex of the frog V** — because a turnout's recorded position *is* its frog, and without it the board would place the part about 3¾″ from where it really sits. It declines rather than guess.

### Fixed
- **A turnout part with only some of its measurements no longer produces a confident wrong answer.** Measuring the points but not the frog was a case nothing had met before, and it quietly fell back to treating the frog as if it were the points — which would have moved a #6's rail end by 3½″. The board now keeps the two questions apart: what it knows, it draws; what it doesn't, it says so about.
- **The parts backlog names the reading each part is actually missing** instead of "dimensions present but inconsistent".

---

## v0.59.2 — 2026-07-31

### Changed
- **A manufacturer's published measurements now count towards drawing a turnout's body.** The board would only draw a turnout's tie strip and its rail joints from figures somebody had measured with a rule, on the grounds that a *calculated* figure would be a guess dressed up as a fact. A manufacturer's own published specification isn't a guess, so it counts now — calculated figures still don't, which is why the generic turnouts still draw no body.

  ⚠️ Nothing changes on any board yet: no Fast Tracks turnout publishes where its **points** sit along its length, and that is the number the drawing needs. What this does is halve the work — the overall length is already published, so one measurement off the real part now finishes the job instead of two.

---

## v0.59.1 — 2026-07-31

### Fixed
- **A route to a third endplate no longer gets told it crosses Main 2 when it doesn't.** The board worked out which side of the mainline such a route leaves on from the turnout's *hand* — but a route to an endplate doesn't run along the module at all, it runs across it, so there was no direction for the hand to answer about and it answered anyway. On a right-hand turnout it guessed the wrong side, and the crossing check then reported a diamond with Main 2 that isn't there.

  The endplate settles it: the route has to reach the plate, so the side it leaves on is the side the plate is on. That is also what the rest of the board was already using, so the warning and the drawing now agree.

  A route that genuinely does cross Main 2 is still reported.

---

## v0.59.0 — 2026-07-31

### Fixed
- **A route to a third endplate can now actually take hold of the turnout it leaves from.** Track snaps to a turnout's diverging rail when you bring it near — but "near" was measured as a flat inch and a half from the *end of the rail*, and a route is created at the turnout's **frog**, which sits inside the part. On a #6 that start is 1.63″ from the rail end, on a #12 it is 3.04″ — both further than the allowance. So a route the board had just made could not connect to the turnout it had just been told it comes from, and showed an amber "nothing is joined here" ring for a gap you could not close without first dragging it away and back.

  The allowance now includes how far the turnout itself reaches, so it means what it always read as: near enough to *this turnout* to be meant for it. Bigger turnouts get more room rather than less, which is the way round it should always have been.

  A route you have deliberately parked well clear of its turnout still stays where you put it.

---

## v0.58.0 — 2026-07-31

### Fixed
- **A route to a third endplate no longer asks you to buy flex for track its turnout already provides.** A turnout's position marks its **frog** — the V where the rails cross — which sits a little way *inside* the part. A route drawn from that point therefore starts inside the turnout, and its first inch and a half on a #6 is moulding, not track you lay. The board was counting all of it as flex.

  On the test module the route is still 22.2″ long, because that is the line that was drawn — but it now reports **20.6″ of flex**, which is what you would actually cut.

  The deduction is what is *left* of the turnout's rail after your own track's starting point is accounted for. So if you have already dragged the route's end onto the turnout's rail, nothing is deducted twice: both ways of drawing it give the same answer. Nothing about your saved document changes — only the figure the panel reports.

---

## v0.57.2 — 2026-07-31

### Changed
- **Housekeeping, no change to what the board draws.** Where a turnout's diverging route goes — and, crucially, where its rail *ends* — was worked out inside the board itself, so nothing else in the app could ask that question. It now lives in the shared track model, which is the groundwork for a route knowing that its own flex starts where the turnout stops rather than at the frog inside it. Every drawn line is unchanged.

---

## v0.57.1 — 2026-07-31

### Changed
- **Housekeeping, no change to what the board does.** The last two places that worked out what a route *is* by reading the word stored on it now measure its shape instead, like the rest of the editor already does. Same tracks drawn, same tracks saved — the reasoning is just no longer split between two different tests that could drift apart.

---

## v0.57.0 — 2026-07-31

### Fixed
- **A route that runs to a third endplate is now cut into lengths of flex like any other track.** It reported its real length in the last release but still showed *"its lengths of flex aren't worked out yet"* — because it was being measured along the *module*, and a route that leaves the main and crosses the board covers almost none of the module's length. On the test module it runs 22.2″ of real track between two points that are both 27.8″ from endplate A.

  It is measured along **itself** now: nothing at the turnout, its full drawn length at the endplate face. So the panel tells you how many lengths of flex the route takes and where the rail joints fall, and the joints are drawn on the line you actually drew rather than collapsed onto the turnout.

  If something sits on the route whose position was recorded along the module, the route is left uncut and the panel says so — a joint nobody has checked is worse than no joint.

### Changed
- **The board stops deciding what a route *is* from the word stored on it.** A route out and a return loop are both drawn as a path across the board, and the editor was reading the label to tell them apart — so a return loop was told it ran to "endplate ?", and a route out was still called a branch. It asks the shape now and says which of the two it has. What a route means for operations stays the layout's business, not the module's.

---

## v0.56.4 — 2026-07-30

### Fixed
- **A crossover whose two halves don't reach each other now says so.** The warning was exactly backwards: a correctly built crossover showed open rings on its crossing (fixed in the last release), while one with a turnout out of place showed **nothing at all**.

  The reason was that when the two halves fall short, the board draws a band across the gap to keep the route looking continuous — and that band was then counted as the thing joining the rails. So the drawing covered the hole and the cover was taken as proof there was no hole.

  A crossover's band no longer counts as a connection. Its rails are judged on whether they actually reach each other, which is what the warning is asking about. A crossover built right stays silent; one that isn't gets its rings back.

## v0.56.3 — 2026-07-30

### Fixed
- **A crossover no longer says its rails are unconnected when they meet each other.** The open amber ring means "nothing is joined to this turnout's rail — bring your track to it". A crossover has a turnout at *both* ends of its connector, and their rails run to the same point in the middle — the scissors on a double crossover. They meet there; nothing is missing. But the check only knew how to spot a *drawn track's* end nearby, so the one thing it couldn't recognise was a rail being met by another rail — and a double crossover ended up with **four** rings stacked on its crossing, each asking you to connect something that was already connected.

  Rails that meet each other now count as joined. A siding or spur is unaffected — it has one turnout, so it still rings when its track is away — and a crossover whose two halves genuinely don't reach each other keeps its warning.

## v0.56.2 — 2026-07-30

### Fixed
- **The length in the Objects list now matches the one in the panel.** The previous release taught a route to an endplate to report its real length, but the row in the Objects list worked its own length out separately and went on showing **0″**. Both now read the same figure, so a route to an endplate lists as **22.2″** on the test module instead of nothing.

- **And it no longer claims its flex is already accounted for.** That same route briefly said *"No flex on this run — the parts fill it."* It doesn't and they don't: nothing has been cut because the app can't yet say how far along a cross-board route a rail joint sits. It goes back to saying exactly that.

## v0.56.1 — 2026-07-30

### Fixed
- **A route to an endplate now shows how long it actually is, instead of 0″.** These routes run *across* the board rather than along it, and their length was being measured along the module — the distance between where the route starts and ends *as seen from endplate A*. For a route that leaves the main and heads for the fascia, those two are almost the same place, so the answer came out as zero. On the test module it read **0″** for **22.2″** of track.

  It now measures the line you drew, which is what every other drawn track already does.

  ⚠️ Its **flex lengths are still not worked out** — the panel goes on saying so. Knowing how long a route is and knowing where to cut it into lengths of flex are different questions: the second needs a way to say *how far along the route* a rail joint sits, and that doesn't exist yet for a route that crosses the board. The length is honest now; the cutting list is still blank rather than wrong.

## v0.56.0 — 2026-07-30

### Changed
- **A route that reaches an endplate is a main, and you're no longer asked to say otherwise.** When you placed a third endplate, the panel asked whether the route to it was a "Branch line" or a "Diverging main". That question is gone, and the route is a main.

  The reason is that it was the wrong question to ask *here*. Whether a route is a branch line is a fact about the **layout** — who owns it, where it goes, what it does at the far end — and your module can't see any of that. What your module knows is narrower and certain: there is an endplate here, and track reaches it. That makes it a way out of the module, which is a main. What it becomes operationally is for the dispatcher to work out once your module is in a layout.

  You still name it whatever you like — "Branch 1", "the CN connection" — and the name is what appears on the board. Nothing changes for modules you have already built: they keep exactly what they were saved with until you edit them.

## v0.55.2 — 2026-07-30

### Fixed
- **You can drag the end of a track that meets a turnout.** Every point on a siding, spur or branch route could be dragged except the one at the turnout — the *throat*. It looked exactly like the other handles and simply refused to move, with nothing on screen to say why. If that was the end you reached for, the whole route felt stuck.

  It moves now, like every other point. Bring it near the turnout's diverging rail and it still snaps onto it, exactly as it did before; leave it away from the turnout and it stays where you put it, and the open ring appears to show the two aren't joined.

  This finishes a change from an earlier release: track stopped being welded to turnouts automatically, and was meant to snap by hand instead. The throat was the one place still holding on.

## v0.55.1 — 2026-07-30

### Fixed
- **The two halves of a crossover's diagonal now meet exactly.** Each of the two turnouts in a diagonal works out how far its rail should run by halving the gap to the track opposite. It measured that gap off its own mainline — which is fine while the two mains are parallel, but through a crossover they aren't: they squeeze together from the module's 1.125″ spacing to the crossover's own 1.09″, and the second main does all the moving. Measured from a main that is on the move, the gap came out slightly different for each of the pair, so the two halves of one diagonal ran to slightly different lengths and missed each other by about 0.04″ at the crossing.

  Both now take the gap from the crossover's published track spacing, so they arrive at the middle together by construction rather than by two measurements happening to agree.

  Far too small to see at normal zoom — this is only visible zoomed right in — but the two rails either did meet or they didn't.

## v0.55.0 — 2026-07-30

### Fixed
- **A double crossover's rails now start where the crossover actually starts.** The four turnouts in a crossover were drawn as if they were ordinary turnouts, working out where each diverging rail begins from a rule of thumb for the frog number rather than from the crossover's own published dimensions. On a #6 that rule says the rail begins 3.30″ before the frog; the real assembly says 2.12″. So every one of the four rails set off about 1.2″ too early, and the diagonals reached the middle without ever lining up on the frogs — which is what makes a crossover look like it doesn't join up.

  The frogs themselves were always in the right place — they sit where you put the turnouts — so what looked like a gap was really the *other* end of each rail being wrong.

  Each rail now begins exactly where the product's own geometry says its points are, and each diagonal comes out as exactly half the crossing, meeting its partner in the middle. Nothing about your module changes, and nothing new had to be measured: it comes from the crossing angle the manufacturer already publishes.

## v0.54.3 — 2026-07-30

### Changed
- **Your module is saved when you change it — and not otherwise.** Until now the app saved whenever the module it was holding differed in any way from the one it loaded, whether or not anyone had touched it. That sounds like the same thing, and almost always is. It wasn't in one case that mattered: a module whose measurements were altered as it *loaded* looked changed, so it was written back — before there was anything to undo. That is what blunted a crossover's measurements in the previous release.

  Saving now waits for an actual edit. Open a module, look at it, change your mind and leave: nothing is written. Move a turnout, rename a track, undo something — saved a second later, exactly as before.

  If a module ever does come out of loading different from the way it was stored, the app now leaves the stored copy alone and says so in the browser console, instead of quietly making the change permanent.

## v0.54.2 — 2026-07-30

### Fixed
- **Opening a module no longer blunts the measurements in it.** Every position in a module — a turnout's place along the main, where a siding starts and ends, a crossing, a branch — was being rounded to the nearest hundredth of an inch **as the module loaded**, before you had done anything. Since the editor saves as you work, that rounded figure could then be written back over what you had actually recorded.

  For most modules the difference was invisible. Where it bit was the trackwork the app works out for you: a scissors crossover's turnouts are placed at figures like **40.104″**, and the module was reloading them as 40.1″ — so the app could not hold on to a number it had calculated itself. **Undo could not help**, because the rounding happened as the module opened, before there was anything to undo.

  Positions are now left exactly as recorded. Rounding still happens in the one case it was meant for: when a module's **length changes** and every feature in it has to be rescaled to fit.

## v0.54.1 — 2026-07-30

### Fixed
- **The parts palette no longer says crossings aren't modelled — they are.** Picking **Crossing** told you the geometry didn't exist yet. It does: a crossing is the angle its two tracks cross at, and the app has understood that since the last package release. What is actually missing is a **measured product** — nobody has recorded a real crossing's angle and length — and one becomes placeable the moment somebody does. The palette now says that instead.

- **A greyed chip no longer claims there is nothing there when there is.** Hovering **Curved turnout** read *"Nothing here yet"*, while selecting it listed Atlas's curved turnout with the real reason beside it — that only its two radii are published, not its points and frog. The hover now gives that same reason, so it agrees with the panel it opens.

## v0.54.0 — 2026-07-30

### Changed
- **Every stretch of track now has two bend handles, so you can draw an S.** There was one ◆ per stretch, and one bend is one arc — it could only ever bow one way. But a length of flex is most often cut to do exactly the opposite: step across to a line parallel to the one it left, out of a turnout and into its lane, or around something and back. That shape needs to bend both ways.

  The **near ◆ bends the first half** of a stretch and the **far ◆ the second**. Pull them opposite ways and you get the S; pull them the same way and you get the bow you have always had. This applies to the mainline, the second main and any siding or spur you have drawn.

  Nothing about your existing track changes. A stretch you have already bowed keeps its exact shape, and its second handle sits on the curve where you left it, so picking it up doesn't move anything until you drag it.

## v0.53.0 — 2026-07-30

### Fixed
- **A track you drew now draws where you drew it — the second main included.** Bending Main 2 by hand looked like it did nothing: the line stayed where the app had put it, and dragging its points seemed to have no effect. The shape *was* being saved — its length in the panel followed your drag the whole time — but the board kept drawing the second main at its standard offset instead of along your line. So the drawing and the saved module quietly disagreed, and the one you could see was not the one being kept.

  Any track carrying a shape you drew is now drawn to that shape. Main 2's ends also **snap onto the turnout's rail** when you bring them close, the way a siding's throat already did, and if an end is left unconnected the open ring appears on the rail to say so.

  ⚠️ **If you bent Main 2 before this release, it may jump** — to where your saved shape actually is, which may not be where the board has been showing it. Drag its ends back (they will snap), or press **Straighten (back to parallel)** to go back to the derived line.

## v0.52.0 — 2026-07-30

### Fixed
- **The second main now curves onto its lane instead of turning a corner.** The previous release got Main 2 to start at the turnout's rail, but it then ran straight at the frog angle and turned square onto the lane — about 9½° on a #6, in one step. Real flex can't do that, and it showed as a kink a few inches past the turnout.

  It now eases the way the rail actually bends: straight at the frog angle out of the turnout, then flattening onto the lane, arriving parallel. It's the same curve the app has always used to work out where a diverging route reaches the next track over — the turnout keeps its true length, and the flex beyond it does the bending, which is what happens on the board.

## v0.51.0 — 2026-07-30

### Fixed
- **The second main now bends off the turnout's rail instead of starting beside it.** On a module that goes from single to double track, Main 2 was drawn starting at its full track spacing from Main 1 — while the turnout's diverging rail ends a little short of that, because a turnout is drawn its real length and no longer. The two met along the board but not across it, so there was a step where the rails should join — about half an inch.

  Main 2 now starts **where the turnout's rail actually ends** and runs on at the same angle until it reaches its lane — which is what the flex track in your hand does. Nothing about your module changes; this is how it was always drawn, corrected.

  The step was about half an inch whatever the turnout — a #10 is a longer part and climbs at a gentler angle, and the two very nearly cancel. What differs is how far the flex runs before it's up at the lane: roughly 3″ on a #6, 5″ on a #10.

## v0.50.0 — 2026-07-30

### Added
- **Track drawn through track is now flagged.** Put a turnout on Main 1 of a double-track module and the siding it feeds lands on the far side of Main 2 — so the route to it has to cross Main 2, and that junction is a diamond: real trackwork you would have to buy or build, and something a dispatcher has to protect. The schematic used to draw the crossing and say nothing about it. Now it says so, in the **Crossings** list: which track is drawn through which, and the turnout it leaves from.

  **It is a note, not a correction.** Nothing is added to your module and nothing moves. If the crossing is real, add it; if it isn't what you meant, start that track from Main 2 instead. The position quoted is the **turnout's**, not the diamond's — where the diamond actually sits depends on the turnout's lead, and that is a measurement the drawing doesn't record, so it isn't invented here.

## v0.49.0 — 2026-07-30

### Changed
- **One palette, for every kind of track piece.** Building track used to mean four different pickers in three different styles — a role menu, a frog-number dropdown, a row of unlabelled icons, and a separate palette of products — and which ones you saw depended on how your module was built. Now there is one palette, grouped the way you would describe your own trackwork: straights, curves, flex, turnouts, curved turnouts, wyes, crossings, crossovers, slips and bumpers.

  **Every entry is a thing you could own, and says so.** Pick a kind and you get the real products in it, by manufacturer, left-hand and right-hand as separate buttons. Anything that cannot be placed yet is still listed, greyed out, **with the reason written underneath** rather than hidden in a tooltip — so "where is my Fast Tracks #6" has an answer on screen.

- **The `Turnout #` dropdown is gone.** Choosing "Atlas #7 LH" has already said #7, so a second control that could disagree with the part had to go. If you do not know the make, say that out loud instead: every kind has a **Generic — make unknown** group, and picking "#6 RH" from it drops exactly what the old dropdown did — a #6, drawn from its frog number, claiming no product.

  **Naming a real product now records it.** Drop an "Atlas #7 LH" on a module you drew the old way and the turnout keeps that part, the same as if you had chosen it in the turnout’s own panel afterwards — so it draws at that product’s measured length. A crossover you name records its product on the connector, where its track spacing belongs.

- **Nothing a drawn module could do has been taken away.** Turnouts, wyes, curved turnouts and single and double crossovers are all still placeable at every frog number the old dropdown offered — and now at the sizes the real product ranges cover as well.

## v0.48.0 — 2026-07-29

### Changed
- **There is one Track button now.** The Pieces tool has folded into Track (T) — laying the parts your track is built from isn't a different job from building track, so it isn't a different button. `P` still takes you to Track, the way `W` does.

  **Your module decides which way T works, because it already knows.** A module that carries track you drew the old way keeps exactly what it had: draw the main, bend a siding, drop a turnout, and the offer to rebuild it as pieces now sits on that same bar. A module built from pieces — and every module you start from now on — gets the parts palette instead, and its derived mainline and sidings are no longer draggable: they're what the pieces add up to, so the pieces are where you change them.

### Added
- **Drag along where the track goes and the run fills with flex.** A 96″ main is four lengths of 30″ flex with three rail joints in it, and now that's one gesture instead of four placements — the run is cut into buyable lengths, the ticks in the preview show you where the joints land, and the pieces meet exactly. Click instead of dragging and you still get the single piece you always did.

## v0.47.1 — 2026-07-28

### Added
- **Your module's track can be rebuilt as the parts it's actually made of — if you tell it what those parts are.** Open the Pieces tool on a module you drew the old way and there's now an offer at the top: name the turnouts you used, and the whole module is laid again as real parts with real ends that join.

  It asks **one question for the module** — "the turnouts on this module are…" — with a folded-away list underneath for the odd one out. Owners lay one kind throughout, and asking turnout by turnout would ask the same question eight times on a yard.

  **It never runs on its own, and one Undo puts it back.** Rebuilding has to supply things your module never recorded — where a frog sits, how long a turnout really is — and inventing those quietly would be putting words in your mouth. Done in front of you, with the cost shown and your answer taken, it's an edit you made.

- **If you genuinely don't know what a turnout is, you can now say so.** The list has a second group below the real products: "#6 — make unknown". Pick one and the module converts, drawn at the right angle and roughly the right length for that frog number — but not as any particular product.

  It tells you that at the moment you choose it, and invites you back to name the real turnout when you find out. Without that you'd reasonably read the drawing as a measurement of your own track, and it isn't one.

### Fixed
- **A double crossover is one assembly, not four turnouts.** Treated as four, a scissors came out as impossible geometry — two turnouts far apart with the crossovers relabelled as sidings — and the module was blamed for ordinary trackwork. A crossover is now laid as the single product it is, so a rebuild handles one the way you built it.
- **A crossover no longer refuses to convert over a measurement nobody needs.** It was asking you to name a measured turnout in order to lay a crossover, which is a different product with its own published geometry.
- **Two turnouts and a piece of track between them are laid as what they are.** Not every pair joining two mains is a factory crossover — plenty are built from separate turnouts, and that's now the assumption unless you name a crossover product.
- **The "tighter than Free-moN" note is gone from crossovers.** The standard fixes 1.125″ track spacing **at the endplate**; what the mains do in between is the builder's business, and every real double crossover pinches them closer. Calling that a deviation read as though your module didn't conform. It does.

## v0.47.0 — 2026-07-27

### Added
- **Drop a turnout onto a run of track and it cuts the track there**, joining both halves to it. Until now a part could only join at an open end, so putting a turnout into the middle of a main — which is where turnouts go — had nowhere to land.

  **An open end still wins.** If there's a joint within reach, that's the intent, and it's more precise; dropping onto track means "cut it here" only when nothing is in reach.

### Fixed
- **A module card drew its board and none of its track.** A module with track but no geometry set had its whole spine refused, so everything positioned along it silently vanished from the drawing. A document that places track is already asserting a main exists — positions are measured in inches from endplate A along it — so the card now says so.

## v0.46.1 — 2026-07-27

### Fixed
- **A sectional curve draws as a curve.** It was laying with its ends in exactly the right places and the rail running dead straight between them. The joints being right is why nothing caught it sooner.

## v0.46.0 — 2026-07-27

### Added
- **The parts library can hold sectional track, and four kinds of part it could never hold at all.** Flex, bumpers, crossovers and sectional pieces had no way in — several of them the parts you're most likely to have a box of. The admin form now offers every kind the app understands, not the five it happened to list.

  A sectional curve records **its own radius and arc** — the two numbers printed on the box. It deliberately doesn't ask for a length: that's the arc between them, and a straight-line length typed into that field would quietly shorten every curve on your module.

## v0.45.0 — 2026-07-27

### Added
- **Lay a bumper and the end reads as finished.** It snaps onto an open end like any other part, and the graph stops calling that end unfinished because it genuinely isn't — not because anything was ticked.

  It's drawn as a **bar across the rails** rather than the short stub its body would otherwise be. Track doesn't just stop; an unmarked bumper would read as a length of unfinished track, which is the one thing it exists to say it isn't.

## v0.44.2 — 2026-07-27

### Fixed
- **The word is "turnout", not "switch".** Four places in the app said switch where they meant a turnout — the transition-module prompt, the part picker and its explanation, and the admin parts page.

  **Manufacturers' product names are left exactly as they're sold**, "Atlas #7 LH Switch 2052" included. A parts library that renames products can't be searched by anyone holding the box.

## v0.44.1 — 2026-07-27

### Fixed
- **One hint in the Track bar, not two.** With the turnout palette moved in beside the track controls, both were showing their own standing hint and telling you different things at once. There's now a single line that says whichever is true — how to drop the armed turnout, or how to bend the track when nothing is armed.

## v0.44.0 — 2026-07-27

### Changed
- **Building track is one job: the Turnout tool has folded into Track.** A turnout isn't a different activity from track — it's a thing you put *on* track. Two buttons meant deciding "am I drawing, or am I switching?" before every action, and the answer was always "I'm building track".

  The turnout palette now sits in the Track tool's own bar. Click a glyph to arm it and the next click on the board drops that turnout; with nothing armed, clicking edits the track exactly as before.

  **Nothing is armed by default**, and that's what makes the merge safe. The old tool could assume a hand, because a click there could only ever mean "drop a turnout". Sharing a tool with drawing, a default would have hijacked every click meant for bending the main.

## v0.43.1 — 2026-07-27

### Fixed
- **The Pieces tool works on modules that already have track.** Laying a piece over an existing main just selected the main — the older track drawn underneath was still catching the click — which made the tool unusable on nearly every real module.

## v0.43.0 — 2026-07-27

### Added
- **Pick the hand you own straight from the palette.** A handed part is now two buttons — "#7 Turnout LH" and "#7 Turnout RH" — each laying that hand directly, with the part number in the tooltip. Laying a right-hand turnout used to mean laying a left one and then finding a "Mirrored" checkbox afterwards; reaching for the part in your hand shouldn't mean knowing that the app spells it "flipped".

  **A wye stays one button.** It splits symmetrically, which is exactly why it's sold as one product — offering a choice would invent one you don't have.

## v0.42.0 — 2026-07-27

### Added
- **Pull a length of flex onto the joint opposite and it cuts itself to fit.** Let go near an open end and both the angle and the length are set so the far end lands exactly there.

  That's what makes a crossover connector layable by hand. Its two ends are fixed by two turnouts, and a length handle only drags along its own axis — so without this you'd have had to type an angle and a length to a hundredth of an inch.

## v0.41.0 — 2026-07-27

### Added
- **A double-track module's second main lays itself.** Both mains start from endplate A's own track points: a double end has two, and the run arriving at the second one is Main 2. Nothing for you to declare, and nothing that can contradict what you drew.

### Fixed
- **Laying Main 2 beside Main 1 used to snap it onto Main 1.** The two mains sit 1.125″ apart — closer together than fourteen screen pixels at any sensible zoom — so the second main was swallowed by the first and the module came out with one main and a warning. The grab now reaches at most half a track spacing: past that you're nearer the other track than the one you meant.
- **New double-track modules were born with their mains swapped**, because the stored track offsets are measured in the endplate's own frame and endplate A faces the other way.

## v0.40.0 — 2026-07-27

### Added
- **Bend a run of flex into a curve.** There's a ◇ in the middle of a selected run — the same handle the benchwork edges already use to bow an edge into an arc. Pull it off the axis and the run curves; push it flat and it's straight again.

  **The readout names the radius**, which is the number a modeller thinks in and the one the standards are written in — not the offset you happen to be dragging. There's a Radius field in the inspector saying the same thing in numbers; leave it blank for straight.

  A piece snapped onto a curved end leaves **along the curve**, turned to the tangent there. And bending track doesn't shorten it: the derived length stays what the rail measures.

## v0.39.0 — 2026-07-27

### Added
- **The Pieces tool: lay track as the parts it's built from.** A new tool (P) with a palette of every part the library can place. Drag one onto the board, or arm it and click. Pieces move, turn, and — flex only, the one piece a builder actually cuts — pull to length.

  **Ends snap, and the snap brings the angle with it.** Dropped a third of an inch short and a quarter-inch high, a length of flex lands exactly on a #7's diverging end *and* turns itself to that turnout's frog angle. Nobody types an angle and nobody types a position; the siding that appears in the panel gets its numbers from the geometry.

  **A joint won't take a second connection.** A third rail end can't be stacked on a junction — it stays where you dropped it, unjoined and reported, rather than being silently dropped out of the layout.

  **Nothing else on your module is touched.** What you lay is stored alongside the track you already have; turning it into your module's tracks is a separate, deliberate step, so laying a piece can never quietly rewrite what's there.

## v0.38.1 — 2026-07-27

### Fixed
- **An endplate bound to a benchwork edge is now drawn at the edge's width.** The binding was reaching the endplate's position and facing but not the drawn face, which kept using the stored width — so on a tapered board whose ends are 16″ and 32″, both faces still drew 24″. That's exactly the disagreement binding an endplate to an edge exists to end.

## v0.38.0 — 2026-07-26

### Added
- **An endplate can now BE an edge of your benchwork, instead of a point floating beside it.** Select an endplate and there's a new question at the top of its panel: *which edge of the benchwork is this?* Pick one, and the endplate's position, facing **and width** all come from the board itself.

  That means they can't disagree any more. Reshape the benchwork and the endplate moves with it — no re-placing, no width to keep in step by hand. On a board whose ends differ in depth, the face follows the real edge instead of being flush only in the middle.

  Curved edges are listed but can't be chosen, and the panel says why: Free-moN wants the track square and level across an endplate, so an endplate face has to be straight.

  **Nothing changes for endplates you've already placed.** They keep the positions you gave them; this is an option, not a conversion. If you do bind one to an edge, that replaces the hand-placed position — keeping both would leave the plate pinned to a spot it no longer sits on.

## v0.37.0 — 2026-07-26

### Fixed
- **A new crossover's two turnouts are now the right distance apart.** They were being spaced by the run needed to cross a full track spacing at the frog angle — but a turnout's position marks its **frog**, and a frog already sits half a track-width off its own centre line. So the diagonal between them only has to cover the bit in the middle, and the turnouts were being placed nearly three times too far apart. A #6 was 6.75″ between frogs; it should be 2.5″.

  On the board that showed up as a diagonal that started steep, went nearly flat across the middle, then turned steep again, instead of holding one clean angle.

  **Crossovers already on your modules are untouched** — this only decides where the turnouts go when you drop a new one, and your existing positions are yours.

## v0.36.3 — 2026-07-26

### Fixed
- **A crossover's diverging routes no longer overshoot each other.** Each turnout was drawing its full body length into the crossover, but on a #6 that reaches further than half the gap between the two tracks — so the two routes crossed *past* one another and the track joining them had to slope back the other way. Zoom in and each diagonal had a visible kink in it.

  A crossover route now stops where it meets the one coming the other way. Only crossovers are affected; every other turnout still draws its full length.

## v0.36.1 — 2026-07-26

### Fixed
- **A double crossover now draws as two diagonals, not six.** On the board, each of the four turnouts was drawing its own diverging route *on top of* the connector between them, and the two turnouts on the second main threw their routes **away** from the pair — off toward the edge of the module, connected to nothing. The dispatcher view was always right; this was the physical view only.

  A crossover now works the way every other track already does: the turnout draws its own diverging rails, and the track it feeds starts where those end. And a crossover's route no longer takes its direction from the turnout's hand — the connector already says where the diagonal goes, which is the other end of it on the other track.

  You should now see what a double crossover actually looks like: two through routes, two diagonals, and the scissors where they cross.

## v0.36.0 — 2026-07-26

### Fixed
- **Naming: a double crossover *contains* a scissors — it isn't one.** We'd been using "scissors crossover" as another name for the whole assembly. It isn't. The assembly is a **double crossover**; the **scissors** is the X inside it, where the two opposite diverging routes meet and cross.

  The palette already said "Double crossover", so nothing you click has changed — this corrects the wording everywhere else, and stops calling that crossing a "diamond". A diamond here means two tracks crossing with **no** route choice; the scissors carries routes and belongs to the crossover.

## v0.35.0 — 2026-07-26

### Added
- **A crossover is now drawn at the spacing it was actually built to, pinch and all.** Tell a crossover what you built it on — there's a new **Built from** picker on the crossover in the track inspector — and the board draws the two tracks as they really run.

  A crossover fixture is cut for **one** track spacing and can't be built to another. The Fast Tracks N crossovers are 1.09″ where Free-moN wants 1.125″, so the pair genuinely closes up by 0.035″ across the crossover and eases back out either side, because your endplates hold the standard spacing at both ends.

  That deviation is about a fifth of a pixel on screen, so drawing it truthfully isn't enough to *see* it. The pinched stretch is highlighted and labelled with the real spacing, so you can tell it's there and by how much.

  **Nothing changes unless you say what you built.** Leave the picker on "Not said" and both tracks stay a standard 1.125″ apart, exactly as before — guessing you'd used a particular fixture would be inventing a fact about your module.

## v0.34.0 — 2026-07-26

### Fixed
- **Correction to yesterday's crossover figures: those lengths are one HALF, not the whole crossover.** v0.33.0 listed the #6 at 10.07″ and the #8 at 13.61″ and called them the finished crossover. They aren't.

  A Fast Tracks crossover fixture builds **one symmetrical half**. You build that piece, build it again, turn the second one 180°, and butt the two together at the through routes and at the X. Fast Tracks' own figure is "the length of the turnout on the QuickSticks" — the piece in the jig.

  These also make a **double crossover**, not a single one: four turnouts, two diagonals, and the **scissors** where the two opposite diverging routes meet and cross in an X. A half carries one full frog and *half* the scissors, so it isn't usable on its own. They're renamed "#N Double Crossover" to match.

  **The finished length isn't published, and we haven't guessed one.** The two halves are mirror images about the diamond so they cover the same span, which suggests the finished crossover is also about 10.07″ — but that's reasoning, not a measurement, and this library has been wrong four times by exactly that route. If you've built one, measure it and we'll record it.

  The track spacing finding is unaffected: still 1.09″ against Free-moN's 1.125″.

### Added
- **Admins can record that a part is built in several identical pieces**, which flags that its lengths describe one piece rather than the finished item.

## v0.33.0 — 2026-07-26

### Added
- **Fast Tracks crossovers are in the parts library — with a spacing warning worth reading.**

  | crossover | angle | 2nd frog | default length | minimum | track spacing |
  |---|---|---|---|---|---|
  | #6 | 9.46° | 19° | 10.07″ | 9.31″ | **1.09″** |
  | #8 | 7.13° | 14.3° | 13.61″ | 13.07″ | **1.09″** |

  ⚠️ **Free-moN requires double track to be spaced 1.125″, and these fixtures build to 1.09″.** A crossover fixture is machined for one spacing and can't be built to another, so a crossover made on either one puts the second track 0.035″ closer than the standard. Your endplates hold 1.125″ at both ends, so the two tracks pinch together through the crossover and open back out.

  It's 0.9 mm and most people will absorb it without thinking about it. It's recorded because it's a real property of the part, not a tolerance, and it's the sort of thing worth knowing *before* you buy a fixture for a double-track module. Nothing warns you or stops you.

  **No Atlas crossovers yet** — we have no figures for them.

- **Admins can record crossover dimensions.** New "Crossover" kind, plus track spacing and second frog angle, with the Free-moN comparison shown on the form.

### Fixed
- **A crossover is no longer offered as an answer to "which switch is this?"** It's an assembly — two turnouts and the diagonal between them — so naming a single turnout as one would have handed that turnout the length of the whole crossover.

## v0.32.0 — 2026-07-26

### Added
- **Fast Tracks turnouts are in the part picker — 14 of them.** If you hand-build your turnouts on a Fast Tracks fixture, you can now say so instead of picking the nearest Atlas part. Nine straight sizes (#4, #4.5, #5, #6, #7, #8, #9, #10, #12) and five wyes (#4, #5, #6, #8, #10), each carrying the diverging-route angle, diverging radius, default and minimum length, and substitution radius that Fast Tracks publish.

  **This fills the #6 gap.** Most turnouts on most modules are a #6, and until now there wasn't a #6 in the library at all — one was interpolated between the measured #5 and #7.

- **Different manufacturers publish different numbers, and the app now keeps both.** Fast Tracks state an angle, two radii and two lengths; Atlas state three landmarks and one length. Neither list contains the other. Rather than flatten them to whatever they share, each part carries what its maker actually says — and blanks stay blank, because a blank is honest and a guess isn't.

  One consequence worth knowing: a Fast Tracks part is a *fixture*, so it has no fixed length — you cut the rail. Its length shows as the maker's **default** with a **minimum**, and because Fast Tracks don't publish where the points and frog sit, these turnouts don't yet draw at a real body length the way the measured Atlas ones do. If you measure your own build, you can enter it and the form will check it for you.

### Fixed
- **A turnout size shared by two manufacturers no longer loses its shape.** Atlas and Fast Tracks both make a #5 and a #7. Picking a part by frog number alone could land on whichever was listed first, so a fixture with no measured landmarks could displace the measured Atlas part — and a turnout with no measurements is drawn as if it has no body, letting flex track run straight through it. Ties now go to the part that can actually be drawn.

## v0.31.0 — 2026-07-26

### Added
- **Both Atlas Code 55 wyes are measured, so they now draw at their real size.** Until today neither wye had any dimensions, and a turnout with no measurements claims no body at all — so flex track ran straight *through* the wye instead of stopping at it. Both are now measured off the physical parts:

  | wye | overall | points | frog | past the frog |
  |---|---|---|---|---|
  | #2.5 (2056) | 6½″ | 1⅝″ | 4⅛″ | 2⅜″ |
  | #3.5 (2057) | 5″ | ¾″ | 3⁵⁄₃₂″ | 1¹³⁄₁₆″ |

  If you have either wye on a module, its drawn length and the point where your flex track begins will both change — they were wrong before, and this is the correction. Nothing else moves: no straight turnout's geometry is affected.

- **Admins can record the diverging rail, and the form checks it against the frog.** There's a new measurement on a track part — frog to the end of the diverging rail, measured *along* the rail. It isn't used for drawing; it's there to catch mistakes. Because the rail runs at an angle it must be slightly longer than the straight-line distance it covers, so if it disagrees with the frog position the form now says so while the part is still in your hand.

  This earned its place immediately: the 2057's frog was first read as 5⁵⁄₃₂″ on a part only 5″ long, which would have put the frog past the end of the turnout. The diverging rail made that impossible and the re-read gave 3⁵⁄₃₂″.

## v0.30.1 — 2026-07-26

### Fixed
- **A junction endplate now sits on the edge of the board, where it belongs.** Place a 3rd endplate on the side of a module and it was being put on the module's **centre line** — buried in the middle of the board, so any track drawn to it stopped in the middle of nowhere. It's an endplate: it's where a train leaves the module, so it belongs on the benchwork border.

  It now lands on the board's own edge, and follows the board's depth — so on a module whose two ends differ in width, a junction partway along sits at the right depth for that point. If you'd already dragged one into place by hand, your position is still used.

- **A new module no longer gets a board outline that goes stale.** Creating a module drew a rectangle at whatever length you first entered, and that rectangle didn't grow when you added a second board — so the module could be 72″ while its drawn board stayed 48″. The boards themselves are the shape now. **Shape this board** still gives any board its own outline when you want to draw one.

## v0.30.0 — 2026-07-26

### Added
- **You can now say what a board's ends are — and the app works out whether they're standard endplates.** Asked for by an owner: *"how would I update my section joints to be endplates from within MR?"* Until now you couldn't. Endplates belonged to the module and were stuck to its two ends; the joints between your boards carried no information at all, so nothing could record that one of them is a real interface.

  Each board now has a **West end** and an **East end**. Say what each presents — an ordinary internal joint, a single- or double-track endplate, or a closed end — and give it a face width if it isn't the usual 24″. The panel then tells you whether it **is** a standard endplate, and where two described ends meet it tells you whether that joint is a **standard interface** — meaning those two boards could be separated and each used against any other module.

  This matters if you build every board with standard endplates so they can be used together or on their own. Until now there was no way to record that, and no way for anyone else to know it.

### Notes
- **There's no "this is an endplate" tickbox, on purpose.** The geometry decides. A box could be ticked wrongly, and then the registry would be telling Free Dispatcher that two boards will physically mate when they won't.
- **Ends of different widths still mate.** The standard allows plates to differ in width and be offset as long as the track lines up — so only the *track count* has to match. A single end meeting a double one is flagged; a 24″ end meeting a 12″ one is not.
- **Leaving an end as "internal joint" is not a fault.** The standard exempts joints inside a module from the end-interface rules, so an undescribed end is simply an ordinary joint.

## v0.29.1 — 2026-07-26

### Fixed
- **Three things were being left behind when you moved or resized a board.** Reorder your boards, or change one's length, and everything placed on them travels along — that was already true for track, turnouts, crossings, signals and industries. But an industry's extra **house-track spots**, a placed **3rd+ endplate**, and your **rail joints** were staying at the inch mark they were on, which after a move is a different board. They come along now.

### Added
- **Removing a board now tells you what's standing on it.** Every other change to your boards can carry things with it, but a board that's gone has nowhere to send them — so they end up on whichever board takes over those inches. Removing a board you've built on now says how many things are on it and gives you the chance to move them first.

## v0.29.0 — 2026-07-26

### Changed
- **A new module now starts as a board, not as a length.** Modules are built from boards, and a module's length is the sum of them — so being asked for a *module total* up front was backwards, and it's what made a multi-board module fight you: every board then had to divide into a fixed number, and changing one stole from its neighbour.

  The create form now asks for the **first board's length and shape**, and the module is created with that one board already in it. Add the next board on the canvas and the module simply gets longer. Nothing to convert, no total to keep in step.

  This also means a **curved board is just a board**. A mostly-straight module with a couple of curved sections in the middle — which no single module-level shape could ever describe — is now the ordinary case rather than something you have to fight the app into.

### Notes
- Modules made before this are untouched and keep working exactly as they did. When you want boards on one, its Module panel has **Build this module from sections →**, which turns the joints you've already drawn into real boards, each with its own length and shape.

## v0.28.0 — 2026-07-26

### Changed
- **Capacity now means what a track can actually hold.** It was measured rail end to rail end — but a car standing too close to the turnout it came off still fouls that route, so those inches hold nothing. Capacity is now measured from the **clearance point**: the point past the frog where a car has drawn far enough clear to stop being in the way. A spur counts from its turnout's clearance point to the end of the track; a siding, clearance point to clearance point.

  **Your numbers will go down, and they were previously too generous.** On Oxnard Auto Port the passing siding goes from 21 cars to 17, and the module from 66 to 59. Nothing about your module changed — only the honesty of the figure. It updates when you next save.

  There's no new measurement to take. Each turnout's clearance point is worked out from the part it is, so a **#5** clears 3.85″ past its frog, a **#7** 5.40″, a **#10** 7.71″ — a shallower frog takes longer to get clear. As the parts library fills in (Admin → Track parts), those figures get truer on their own.

  The clearance distance is the standard's own **1.125″ track spacing** — the distance Free-moN already says two parallel tracks need to coexist, which is the same thing as one car clearing another. That's 15 scale feet centre to centre.

- **The new-module wizard asks for inches, not scale feet.** It used to want "Capacity (scale feet)" with no guidance, which nobody measures — you put a tape on the module and read inches. It now asks for the **usable length in inches** and shows you what that comes to in scale feet and cars as you type. It's also optional now: leave it blank and the schematic builder works it out from your drawing.

### Added
- **A measured override, per track.** A track's panel shows what it's made of — drawn length, what the clearance points take off, and the usable figure. If the real track has something the drawing can't know about — a bumper post short of the end, a structure fouling it — type the length you measured and that's used instead.

- The **Help** page now explains where to measure from, on the track entry it describes.

## v0.27.0 — 2026-07-26

### Fixed
- **You can type a negative number again.** In the benchwork corner fields, the minus sign of "−6" was being read on its own — before the 6 arrived — and there is no such number, so the field fought you. Reported: *"I can't enter '−6'. Instead I have to enter 0 and press − until I get a value −6.xxx and then delete the trailing digits."* Sorry — that's a miserable way to place a corner.

  Those fields now wait until you've finished typing (or press Enter) before taking the value. The same bug was in three other places, all fixed together: the **endplate pose** X, Y and heading, and the **Main 1 offset from plate centre** — which is signed by definition, so a double end's own recommended value of −0.5625″ couldn't be typed at all.

- **"Single track" in the + Track menu did nothing, and didn't explain itself.** Those options don't *add* a track — every module already has a main; it *is* the module's centre line, there from the moment the module has a length. So on a module that was already single-track, clicking "Single track" was a silent no-op. Reported by an owner building a 12×12″ single-track control point who reasonably concluded the track couldn't be added.

  The menu now says the mainline is already on the board and that these choose how many tracks it is — and clicking one **selects the mainline**, opening its panel and putting its handles on the board. That answers the question actually being asked: *where is my track?* (The mainline also became a proper entry in the Objects list in v0.22.0, which is the other half of this.)

## v0.26.0 — 2026-07-26

### Added
- **The Atlas 2057 wye is in the library — it's a #3.5.** The two Atlas Code 55 wyes are different frog numbers, not a left-hand and right-hand pair of the same part (a wye has no hand — both legs diverge). So there are now two to choose between: **#2.5 (2056)** and **#3.5 (2057)**.

  Neither has been measured yet, so both are still drawn from their frog number rather than at a real length. They're in the parts list so you can say which one you're laying.

### Fixed
- **A part known only by its number was being hidden from the Part list.** The list showed parts that carry a measurement, which meant a part we can identify but haven't measured — the new 2057 wye exactly — wouldn't have appeared at all. Since choosing a part now sets the turnout's frog number, knowing which part it is *does* change the drawing, so it belongs on the list.

## v0.25.1 — 2026-07-26

### Added
- **An industry now tells you when its car spots run off the end of the track.** An industry is a span with a start and an end, and its capacity is worked out from those — but nothing checked the span actually fits on the siding it's spotting. So an industry could be counting car spots with no rail under them.

  Its panel now says so, with the numbers: which track it runs off, by how much at each end, how much of the span really has rail under it, and how many of the counted cars can't be spotted. Each house-track spot is checked separately, since each rides its own track.

  **Your numbers are left exactly as you typed them.** The fix is yours to choose — shorten the span, or extend the track to meet it — the same way an off-centre endplate and an over-long piece of flex are flagged rather than quietly corrected.

## v0.25.0 — 2026-07-26

### Fixed
- **You can pan the drawing now — by dragging it.** Panning was already there, but only if you held **Space** and dragged, or dragged with the middle mouse button, and nothing on screen said so. So it read as zoom-only. Will: *"You can[not] pan in the drawing tool, only zoom."*

  Three ways in now, and you don't have to be told about any of them:
  - **Drag the background.** With the Select tool, dragging empty canvas moves the board. Clicking it still clears your selection — a drag pans, a click selects nothing.
  - **Scroll, or two-finger swipe**, to pan in any direction.
  - **Ctrl/⌘ + scroll — or pinch — to zoom.** The wheel used to zoom on its own, which is why a trackpad's two-finger swipe zoomed instead of panning.

  Space-drag and middle-drag still work from any tool, and the **+ / −** buttons and **Fit** are unchanged. The toolbar now says how to move around.

## v0.24.0 — 2026-07-26

### Fixed
- **The turnout Part list offered exactly one thing. It now offers the real parts, by manufacturer.** The list was filtered down to parts carrying an imported *outline* drawing — and only one internal test record has one — so every measured part we hold was hidden, and the single entry on offer wasn't even one of them. Will: *"I gave you more than 1 turnout with measurements … but there is still only one that is in the list."*

  That filter made sense when an outline was all a part contributed. It isn't any more: a part also supplies its **length** — where the moulding stops and your own flex track begins. So the list now offers every part whose measurements change what's drawn, grouped under its **manufacturer**, with part numbers shown: Atlas Code 55 **#5 (2050/2051)**, **#7 (2052/2053)**, **#10 (2054/2055)**, the **wye (2056)** and the **curved turnout (2058/2059)**.

  It also reads the **live** library, so a part added at Admin → Track parts now appears here. Before, the picker was built once from the compiled-in list and never saw anything an admin added.

### Changed
- **The frog number now follows from the part.** Name the switch you're laying and the **Turnout #** is read from it, rather than being a second control you could set to disagree with the part. If you don't know the part, leave it unspecified and set the frog number as before — that path is unchanged, and the turnout is drawn from the number alone.

- **A named part answers for itself.** Its own measured length now drives how long the turnout is drawn and where the rail joints fall, instead of us looking up whichever part in the library happens to share its frog number. Those are the same thing today, and won't be once two parts share a number.

  The panel also tells you which of the three you've got: drawn from a real outline, drawn at the part's measured length, or — for a part we hold no measurements for yet — drawn from the frog number, and where to add them.

## v0.23.1 — 2026-07-26

### Fixed
- **An industry's car-spot span now follows the track it spots on.** The span was drawn beside the module's centre line at the *nominal* offset for its track's lane number — which is the same place the track is, right up until you bend or redraw the track. After that the track went one way and its highlight stayed where the lane said it should be. On a spur drawn well clear of its lane, the highlight could sit a couple of inches off the track it belongs to, pointing at nothing.

  The span now rides the track's own line, so a curved siding gets a curved car-spot span and a hand-drawn one gets a hand-drawn span. The drag handles and the name follow it too. Nothing to change on your part — the spans just move onto their track.

  The straightened **dispatcher** view is unaffected and stays as it was: it's a topological diagram, so a lane offset is the right answer there.

## v0.23.0 — 2026-07-26

### Added
- **Your track is now made of real lengths of flex, with the joints marked.** Everything that isn't a turnout or a crossing is flex track, and flex comes in pieces you can actually buy — **30″** for Atlas Code 55, **36″** for Micro Engineering. So a 96″ main isn't one piece of track: it's four lengths with three rail joints in it. Each length is listed in **Objects** under the track it belongs to, and each joint is marked on the board with the same tick a turnout's joint gets — because it's the same thing.

  **Nothing to do.** Your modules are cut up automatically the first time you open them, using full lengths off the roll with the remainder at the end, exactly how you'd lay it. The flex goes *around* the turnouts we have measured, so a switch in the middle of a run gives you a joint on each side of it rather than a piece of track drawn straight through a part.

- **Pick the product per track.** A track's panel now has a **Flex track** chooser and tells you what that run costs: how many pieces and how many inches. Your mains can be Atlas and a siding Micro Engineering if that's what's on the bench.

- **Resize a piece.** Where you cut is the builder's call, so select a length and retype it — the joint moves and the next piece takes up the difference, which is what cutting one longer really does. Once you've moved one, that run's joints are **yours**: they stay put when something else on the module changes, and they're saved with it. **Re-cut automatically** puts them back.

  A piece too long for the product to supply is flagged in amber rather than quietly re-cut, so a run that grew after you set its joints tells you instead of undoing your decision.

### Notes
- A piece that butts a turnout, a crossing or an endplate has no length field: what it meets is what sets it. Resize the piece before it, or move what it butts against.
- A **branch route** is drawn as a path rather than measured along the module, so its lengths aren't worked out yet — its panel says so instead of showing you a zero.
- A **crossing** breaks the run and gives you a joint, but doesn't take any length off it: we haven't measured a crossing part, and claiming an extent for one would be inventing it.

## v0.22.0 — 2026-07-26

### Added
- **Every piece of track is in the Objects list, and clicking one shows its details.** The list had every siding, spur, industry, turnout and even a benchwork corner — but not the two most important pieces of track on the board. The mainline got an entry last week, though only as a shortcut that armed a tool; **Main 1 and Main 2 are now ordinary selectable objects** like everything else, each showing its length and whether it's drawn or derived.

  Select one and its panel above tells you what it is: its **length** (measured along the path you drew, or derived from the module), its **shape**, its **lane**, and — for a Main 2 that only runs part-way — the stretch it covers between its turnouts. There's a **Straighten** action to put a hand-bent main back to derived.

- **Selecting a main is now what arms its handles.** That's how every other track works: click it, its points go live, drag them. Before, the mainline was edited by having *nothing* selected, which is backwards and was the hard thing to find. The old route still works — pick the Track tool with nothing selected and the main is live, which is how a brand-new module gets its first main drawn — it just isn't the only way in now. Dragging a main's own handle also selects it, so its details open.

  Length is deliberately **not** an editable field. On a derived main the length *is* the module's length, so a second field for it would be a second place to change the same number; on a drawn main it's whatever the line measures. Drag the end, or change the module's length.

### Fixed
- **With Main 2 selected, clicking the canvas bent Main 1.** Under the Track tool the click fell through to the mainline, because Main 2 isn't a siding. It now bends whichever main you have selected. Clicking the background with something *else* selected — a turnout, an endplate — also used to bend the mainline; it now just clears the selection.

## v0.21.0 — 2026-07-26

### Fixed
- **A double-track endplate now sits centred on its two tracks.** The standard puts the two mains of a double end **1.125″ apart, straddling the centre of the plate** — 0.5625″ either side — so the plate is centred on the *pair*, not on Main 1. The board drawings on the module page and in the catalog were centring every plate on **Main 1**, which pushed the whole pair 0.5625″ off centre and put Main 2 that much nearer one fascia than the drawing implied. Modules affected included **Harrisonville MoPac Extension**, **ELM Yard**, **Double Track 30 Degree Curve** and **End of passing Siding**; none of them had authored anything wrong, and they now draw correctly with no change on your part.

  The check for **swapped mains** was wrong in the same way — it assumed Main 2 always ran on one particular side, so on a module with the mains swapped it measured the fascia clearance against the wrong track.

### Added
- **A warning when a double end's two tracks don't straddle its plate.** Off-centre track *is* allowed — the standard relaxed centring to a recommendation, and a transition module often needs it — so this is a note, not an error. It exists because one particular value is almost always an accident: typing **0** in *Main 1 offset from plate centre* means "put Main 1 exactly in the middle", which pushes Main 2 a full 1.125″ off to one side. If you see the warning and didn't intend an offset end, **clear the field** — blank uses the standard's placement. The field's greyed-out placeholder now shows what blank will give you.

## v0.20.2 — 2026-07-26

### Fixed
- **A module with one endplate no longer shows a second one.** Two leftovers from the same wrong assumption as v0.20.0 below, both found by checking the fix on a real single-ended module: the dispatcher view labelled the far end **"B"**, and the board drawings — on the module page and in the catalog — drew an **endplate face** across the end where the track simply stops. Both were asking "is this a loop?" when they meant "has this module got two ends?", which were the same question until single-ended modules could be authored. There is now one answer to that question and all three places ask it.

## v0.20.0 — 2026-07-26

### Fixed
- **A module with one endplate is no longer mistaken for a loop.** Ticking *Only one endplate* — new yesterday — had the side effect of making the module read as a **balloon loop**: the dispatcher view drew a turnback bulb, endplate A was relabelled "Entry", and positions past the far end were treated as being inside a loop that doesn't exist. The cause was an old shortcut that assumed one endplate could only mean a turnback, which stopped being true the moment *end of the line* and *pocket* modules could be authored. A loop is now only ever a loop because you ticked **Loop module**. Nothing you authored is affected, and genuine loops are unchanged.

## v0.19.2 — 2026-07-26

### Added
- **The mainline is in the Objects list.** It was the one thing on the board with no entry there — every siding, industry, turnout and even a benchwork corner was listed, but the module's own spine wasn't, and it can only be reshaped from the Track tool. So it read as something you couldn't change. Click **Mainline** and the Track tool takes over: drag its end to set how far the main runs, drag the ◇ on a stretch to curve it, click the line to add a bend. The entry also tells you whether the main is *drawn* or still *derived* from the module's shape.

  On a module with **only one endplate**, the main can now stop short of the far edge — drag its end inward and the board keeps its full length while the track ends where you put it. That's the *end of the line* and *pocket* case; on a module with two endplates the main is expected to reach both.

## v0.19.0 — 2026-07-26

### Added
- **A module can have just one endplate.** *End of the line* and *pocket* modules present a single conforming face and the track simply stops — but there was no way to say so: every module was given two endplates and neither could be removed. Tick **Only one endplate** in the Module panel and end B's plate goes away, along with its endplate record, so nothing offers to couple to an end that isn't there.

  The endplate standard governs the faces your module *offers for joining*; it never required a module to offer two. The setting is in the Module panel rather than on endplate B, for the obvious reason that once B is gone there'd be no B to click to get it back.

## v0.18.0 — 2026-07-26

### Changed
- **A third endplate is an end of your module, and the dispatcher view now draws it as one.** An endplate is an endplate whatever letter it carries — it's the standardised face where your module joins another, and a module may present two of them, or three, or one. The operations view didn't see it that way: endplates A and B ended the diagram and were labelled, while C and up were drawn as a short stub hanging off the side.

  A route to endplate C now **runs to the edge of the module and finishes at an endplate face carrying its letter**, exactly as the mains to A and B do. It's drawn well clear of the other tracks, with a lane's gap, so that a route running the full width can't be mistaken for another main running alongside — it's an *exit*, not a parallel track.

  The **letter** is your module's own fact, so it's shown. Where that route actually goes is not: that depends on which module is physically coupled to that endplate on the day, so Free-Dispatcher works the destination out from the assembled layout rather than the Repository guessing at it.

## v0.17.2 — 2026-07-26

### Added
- **Rail joints are marked.** Now that a turnout is drawn its real length, you can see where the part ends and your own track begins — a small tick across the rails marks each joint: at both ends of the turnout along the through route, and at the end of the diverging rail once track is connected to it. A rail with nothing connected still shows the amber ring instead, so the two never appear together: the ring means "bring track here", the tick means "these two pieces meet here". Joints appear on the through route only for turnouts whose part we have measured — for anything else we don't know where the moulding stops, and would rather mark nothing than mark the wrong place.

## v0.17.0 — 2026-07-25

### Changed
- **⚠️ Turnouts are now drawn their real size — and your track no longer attaches itself to them. You will need to connect it up.**

  **What was wrong.** A turnout's diverging route was drawn running until it came back **parallel** with the track it fed. On an Atlas #7 that meant drawing about **10¾″** of switch — for a part that is **6″ long end to end**. The geometry was right in itself; it just wasn't turnout. Everything past the moulding is flex track *you* lay, and drawing it as one continuous piece is why turnouts looked enormous and why the tracks around them looked short.

  **What happens now.** A turnout is drawn as long as the turnout actually is: from its points, through the frog, to the end of its own rails. Where we have measured the part, that is its exact length — an Atlas #7 draws 6″, a #5 6″, a #10 8″. For a frog number we have no measurement for, the length is estimated from the ones we do have, which is still far closer than before.

  **What you need to do.** Because the drawing no longer stretches a turnout out to meet your track, **there is now a real gap between the two on modules built before this change** — and you close it the way you would on the bench, by laying track between them.

  1. Open your module in the builder. Look for an **amber dashed ring** — that marks a turnout rail with nothing connected to it.
  2. Pick up the **end of the track** (not the turnout) and drag it onto that ring.
  3. It **snaps** when it gets close, and the ring disappears once connected.

  Drag the **track**, never the turnout: a turnout is positioned by its frog, so it stays where you put it and the track comes to meet it. Nothing you authored has been moved or deleted — positions, lengths and capacities are all exactly as you left them, and the dispatcher view is unaffected, so operations keep working while you catch up.

  **This includes routes to a third endplate.** A junction route used to be held against its turnout automatically (see v0.15.50 below); it is now ordinary track like everything else, so it starts where you put it and snaps to the switch the same way. If you move a turnout, its route stays put rather than being dragged along — connect them up again by dragging the route's end back onto the rail.

## v0.16.0 — 2026-07-25

### Added
- **The turnout parts library can now be added to from inside the app.** Turnouts are drawn from measured parts, and the list of parts used to be fixed until the next release — so a frog number nobody had measured could never be drawn properly. Administrators can now add a manufacturer's switch under **Admin → Track parts**, and every module drawing picks it up. The Atlas code 55 parts that shipped with the app are in the same list and can be corrected there too. Measurements are entered as **positions along the part** rather than lengths, with a diagram showing exactly which features to measure from, and each one records where the number came from.

## v0.15.52 — 2026-07-25

### Added
- **You can see where the turnout ends and your own track begins.** A turnout now draws its **body** — the moulded tie strip — so the part itself is distinguishable from the flex track running on past it. It appears only for parts we have actually measured; a frog number with no measured part is drawn without one, rather than guessing at a length.

## v0.15.51 — 2026-07-25

### Fixed
- **Endplates that were never moved by hand follow their module again.** If a derived endplate position was ever written into a module, it quietly became a *manual* one and stopped tracking the module's length — so changing the length could leave an endplate behind. On one module endplate B was pinned 0.1″ past the end of its own board. Positions you set by hand are untouched and still take precedence.

## v0.15.50 — 2026-07-25

### Fixed
- **A route to a third endplate stays attached to its turnout.** The drawn route was stored from wherever it was first created, and moving the turnout afterwards left it behind — the builder hid this by re-attaching it on screen, but the module's own page drew the route floating clear of the switch feeding it, by 11″ on one module. Moving a turnout now carries its route with it, and existing modules draw correctly straight away.

## v0.15.49 — 2026-07-25

### Changed
- **A branch to a third endplate is drawn as the main it is.** A route leaving the module at a third endplate was missing from the operations view altogether — it had no position along the module, so it was skipped and only a small arrow was drawn at the edge. It now appears as a proper route: it leaves the main at its turnout, runs its own length on a track of its own, and ends at an endplate face. Whether it is drawn as a main or a branch follows what you set on the endplate.

## v0.15.48 — 2026-07-25

### Fixed
- **A flipped turnout now diverges the same way in both views.** You tell a switch three things: which track it sits on, whether it's left- or right-hand, and whether it's rotated 180°. The drawing canvas read all three, but the dispatcher view read only the first two — it ignored **Rotated 180°** entirely. So a flipped turnout's route was drawn above the main in one view and below it in the other. Both views now work out the diverging side from the same rule, using all three of your settings. (Reported on FMN-0068.)

## v0.15.47 — 2026-07-25

### Fixed
- **The mainline's rails no longer vanish under a switch.** Where a turnout's leg crossed the main, the main's rails disappeared for that stretch — so the diverging route looked properly connected while the through route appeared to stop and restart. The rails were never missing: each track was drawing its pale ballast band and its rails together, and because the main is drawn first, every later track's band painted straight over the main's rails and buried them. Ballast for every track is now laid down first, and all the rails go on top, so nothing can cover anything else. Both routes' rails now read as continuous through the switch. (Reported on FMN-0068, FMN-0073 and VMN-0064.)

## v0.15.46 — 2026-07-25

### Fixed
- **The mainline's rails no longer cut off at a wye.** Where a wye sat on the main, the main's rails were deliberately erased across it — a hangover from when the main was drawn as a plain band that would have run straight through the middle of the Y. Worse, the erased stretch was as long as **the whole track the wye fed**, so a wye feeding a 30″ siding wiped out 30″ of mainline. The main is now drawn end to end, and both routes' rails meet at the switch instead of one being hidden to make room for the other. (Reported on FMN-0068, FMN-0073 and VMN-0064.)

## v0.15.45 — 2026-07-25

### Fixed
- **Short spurs keep their track.** The easing curve added moments earlier made a turnout's diverging route about 1¾″ longer, and a track begins where that route ends — so on a spur shorter than roughly 10¾″ the start ran past the finish and **the track disappeared**, leaving rails stopping in mid-air. The curve now uses only the room the track actually has, easing as much as it can and straightening out entirely where there isn't space. A short spur is back to how it looked before, and anything with room keeps the smooth join.

## v0.15.44 — 2026-07-25

### Fixed
- **The diverging route now eases back parallel, so the rails line up.** Where a turnout's diverging leg met the track it feeds, it arrived at the right spacing but was **still angling away** — while the track it joined ran parallel to the main. Track can't change direction instantly, and because each rail sits square to its own direction, the two rails ended up meeting at slightly different points. That's the misalignment you've been seeing at switches; it was never a gap, it was a kink. The route now runs straight at the frog angle and then **curves gently back to parallel** before it joins, on about a 25″ radius — comfortably inside the Free-moN 22″ minimum. A turnout's diverging route is correspondingly **longer** (about 10¾″ rather than 9″ on a #7), because it needs the room to come back parallel. Turnout positions, frogs and leads are unchanged, and nothing you authored moves.

## v0.15.43 — 2026-07-24

### Fixed
- **The frog marker sits on the frog.** A turnout's frog marker — and the V drawn at it — were placed on the diverging route's centre line, which at the frog is a full track gauge away from the main. But the frog is where the two **inner rails cross**, and that is half a gauge out. The marker was landing about 0.18″ clear of the rails it was supposed to mark, so the V never quite lined up with the crossing. Turnout positions and everything you authored are unchanged; only the marker moves.

## v0.15.42 — 2026-07-24

### Added
- **Say which part a turnout actually is.** A turnout's inspector now has a **Part** field. Leave it unset and the switch is drawn the way it always has been, from its frog number. Choose a part and it's drawn using **that part's own outline**, so what you see is the shape of the thing you'll lay rather than a shape calculated from a number. The part's frog should land on the turnout's position marker — if it visibly misses, that part's published geometry disagrees with our measurements, which is worth knowing. Only one part carries an outline today; importing your own XTrkCAD library is the next step.

## v0.15.41 — 2026-07-24

### Changed
- **Turnouts are drawn at their real measured size.** Every switch used to be sized by a formula — points-to-frog was just the frog number times a constant. That constant came from one measurement and turned out to be wrong in both directions: about 20% short on a #5 and 13% long on a #10. Turnouts are now drawn from **physical measurements of Atlas code 55 parts** (#5, #7 and #10 measured end to end, points and frog), and in-between sizes are interpolated between real parts rather than multiplied out. **Every turnout on every module redraws** — the throat moves, most noticeably on #4s and #6s. Nothing you authored has changed; a turnout's position still marks its frog.

## v0.15.40 — 2026-07-24

### Changed
- **Turnouts look like turnouts.** Switches were drawn as a plain wedge off the mainline. They are now drawn as real track: **rails instead of a solid band** once you zoom in far enough to see them, the **point rails tapering off the stock rail**, and a genuine **frog** where the two inner rails cross. The shape isn't decoration — it comes from the actual closure geometry, which is why the points and frog land where they do.
- **The rails run continuously through a switch.** Where a turnout's diverging leg met the track it feeds, the two were drawn separately and didn't quite meet — a visible break, and on some modules a sideways jog. The leg now runs until it reaches its track's lane and the track begins where the leg ends.
- **Diverging routes leave at the correct angle in the dispatcher view**, instead of every switch being drawn the same.

### Fixed
- **Wyes no longer split at twice the correct angle.** A wye's two legs each leave at half the frog angle; the halving was being applied twice.
- **Authored positions keep their fractions.** Positions typed with a decimal — a turnout at 17.4″ — were being rounded to whole inches when a module was opened, silently moving things you had placed. (Affected any module whose length had been changed since authoring.)

## v0.15.39 — 2026-07-24

### Added
- **Admins can open any module's builder, read-only.** Useful for looking into a reported problem without needing the owner present. Nothing can be saved from a read-only session — edits are inert, not merely hidden.

### Fixed
- **No more false "diverges to itself" warning.** A turnout whose diverging route pointed at its own host track raised a warning that couldn't be cleared. Choosing a new host in the dropdown now swaps the two rather than colliding, and existing modules with the problem are repaired when opened. (Reported by Steve Branton.)

## v0.15.38 — 2026-07-20

### Fixed
- **The drawing canvas centres a double-track endplate on its two tracks too** — v0.15.37 fixed the module illustration but the editor canvas still drew the plate centred on Main 1.

## v0.15.37 — 2026-07-20

### Fixed
- **Double-track endplates draw centred on their two tracks.** Free-moN puts each track 9/16″ either side of a double-track endplate’s centre, but the board and endplate face were drawn centred on Main 1 — so the pair sat half a track-spacing off. The plate now centres on the track pair; the track itself hasn’t moved, so joints are unaffected. (Reported on Ventura East Single-2-Double.)

### Added
- **Endplate width warnings.** An endplate now warns when it breaks the standard: narrower than the **12″ minimum**, or with a track closer than **4″ to a fascia** — and tells you the width that would satisfy it.

## v0.15.36 — 2026-07-20

### Added
- **Swap Main 1 / Main 2 positions.** On a double-track module the Module panel now has a **Swap Main 1 / Main 2 positions** checkbox — draw Main 1 above and Main 2 on the centre line, for a module whose upper track is the primary main. Names, turnouts, industries and signals stay exactly where they are; only where the two mains are drawn changes. (Requested on Ventura East Single-2-Double.)

## v0.15.35 — 2026-07-20

### Fixed
- **Spurs draw the way they actually run.** A spur that runs **west** from its turnout was drawn heading east to an arbitrary end point — the drawing ignored which way the track actually goes. It now follows the track's own ends. (Reported on Oxnard Auto Port.)
- **A passing siding connects at both ends.** A siding with a turnout at each end only joined the main at one of them; both switches now draw their connection. (Reported on Oxnard Auto Port.)
- **A transition module no longer runs both mains to the single-track end.** When the *upper* main is the one that continues endplate to endplate, the other main now correctly stops at the End of Double Track turnout. (Reported on Ventura East Single-2-Double.)

## v0.15.34 — 2026-07-19

### Changed
- **Endplate records follow the drawing.** Saving the schematic now syncs the module's endplate records: each plate's **track config** (single/double) matches what's drawn, quick-create modules gain their endplate rows on first save, and an authored endplate width carries over — so module joining downstream sees the real interface. Existing rows keep their hand-authored labels/notes, and they no longer lock the canvas (the drawing is the source of truth).

## v0.15.33 — 2026-07-19

### Changed
- **A track on an endplate makes it a double-track endplate.** Drag a parallel track's end onto an endplate and the module reflects it automatically (so modules snap together correctly downstream): that plate flips to double and the track becomes **Main 2**. Touch one plate and you get a proper **transition module** — the End of Double Track turnout and control point land exactly where your track ended. Then drag that turnout onto the far plate to complete the full double main. (Endplate records stay authoritative — locked configs are never overridden.)

## v0.15.32 — 2026-07-19

### Added
- **Make a parallel track the second main.** A plain lane-1 track (your merged crossover parallel, say) now has a **"Make this the second main (double mainline)"** button in its inspector: both endplates become double-track, **Main 2 runs endplate to endplate**, and everything attached — turnouts, industries, signals — moves onto it. (Hidden when the endplate records lock the config, on loops, or if the main is already double.)

## v0.15.31 — 2026-07-19

### Changed
- **Joined tracks become one track.** When you drag a track's end onto another track on the same lane (the snap makes them meet exactly), they now **merge into a single track** — one name, one capacity, spanning both — and everything attached (turnouts, industries, crossings, signals) follows onto the merged track. Spurs and crossover connectors never merge.

## v0.15.30 — 2026-07-19

### Added
- **Track ends snap together.** Dragging a track's ○ end near another track's end on the same lane snaps to it exactly — so the parallel tracks of two crossovers (or a siding and a yard track) join into one continuous run without fiddling. The readout shows which track it meets.

## v0.15.29 — 2026-07-19

### Fixed
- **Crossover diagonals sit where the crossover is** in the operations preview. Turnout positions are now always absolute (inches from A) — the crossover was storing its far-side turnouts relative to the parallel track, so the dispatcher drew its diagonals stretched across half the module.

## v0.15.28 — 2026-07-19

### Fixed
- **Cleaner dispatcher view around crossovers.** A crossover's parallel track no longer draws spurious end-dips into the main in the operations preview — it renders flat, with the crossover diagonal as its only connection. (Classic passing sidings are unchanged.)
- **No more doubled switch nodes.** The frog circle is drawn once per switch — a crossover put a turnout on both ends of its connector and the shared frog drew twice.
- **Tidy lengths in the Objects list.** Track lengths and positions round to 0.1″ instead of showing floating-point noise (18.800000000000004″).

## v0.15.27 — 2026-07-19

### Added
- **Crossovers** — the palette's **single LH, single RH, and double (scissors) crossover** glyphs are now live. Drop one on the main: the side you drop on picks where the parallel lane goes, a turnout lands on each track with the **diagonal connector** between them (sized by the frog # — the diagonal crosses one track-spacing at the frog angle), and if a parallel track already covers that spot it's **reused** (a siding, say); otherwise a short parallel stub appears for you to **draw out to length**.

## v0.15.26 — 2026-07-19

### Changed
- **True 2-way wyes** — the straight main no longer draws through a wye; the two mirrored legs take over where it splits, so it reads as a real Y. (The main stays the coordinate spine underneath.)

## v0.15.25 — 2026-07-19

### Changed
- **Wyes render symmetrically.** A wye turnout now splits into **two mirrored routes**, each diverging at half the frog angle from center — a proper Y — instead of a single one-sided leg. (Based on the Fast Tracks wye template.)

## v0.15.24 — 2026-07-19

### Changed
- **Diverging routes angle away like the real turnout.** A turnout's spur now continues at the frog angle — a straight turnout throws a single clean diagonal (atan(1/#)), a curved one carries the curve on — instead of bending back to run alongside the main. Drag the far end to lengthen the diverging track. (Based on the Fast Tracks prototype geometry.)

## v0.15.23 — 2026-07-19

### Changed
- **Prominent switch nodes** — a turnout now shows clear white **snap circles** at its points (where the diverging route leaves the main) and at its frog, so a switch reads as connected sections meeting at the round node, like a track plan.

## v0.15.22 — 2026-07-19

### Fixed
- **Drawing the mainline keeps the board aligned.** The main's end clicks now snap onto the endplates (the board's fixed ends), so a slightly-off click no longer tilts the main, drifts the endplate faces off the benchwork, or grows the board. Click near either end and it lands exactly on the endplate.

### Changed
- **Curved turnouts are more pronounced and stay on curved track.** A curved turnout's diverging route now sweeps over a longer arc so it reads as a real curve, not a subtle bow. And a curved turnout can only be dropped on **curved** track — drop one on a straight section and it tells you to bend the track first (or use a straight turnout).

## v0.15.21 — 2026-07-19

### Added
- **Curved turnouts** — the turnout palette's **curved left/right** glyphs are now live. Drop one and the diverging leg **bows into an arc** (both routes curve the same way) instead of leaving as a straight diagonal — the prototypical look for a switch on a curve. Any turnout can be made curved (or straightened) with the new **Curved** toggle in its inspector.

## v0.15.20 — 2026-07-19

### Fixed
- **Creating a new module works again.** Since the blank-module change, the new-module form submitted no geometry — but the database still required one, so every create failed with a foreign-key error. Geometry is now genuinely optional (a module's mainline is drawn on the canvas, not declared up front), and creation succeeds.

## v0.15.19 — 2026-07-19

### Added
- **Turnout palette** — the Turnout tool now shows draggable switch glyphs (**left-hand, right-hand, wye**). Drag one onto a track — or click a glyph, then click the board — and the turnout lands **already carrying a short diverging spur stub** you drag by its ○ end to size. Curved turnouts, crossovers, and slips appear as placeholders for what's next.

### Fixed
- **Turnout/spur length no longer changes on release.** Dropping a turnout is now a point placement, and its spur is positioned by its end (which you drag), so the track can't shift out from under what you placed — the old draw-to-create re-projected the drawn end onto the main and changed its length.

## v0.15.18 — 2026-07-19

### Added
- **Confirm before deleting a module** — the Delete module button now asks you to confirm first (it permanently removes the module and its whole schematic), so a stray click can't wipe one.

## v0.15.17 — 2026-07-19

### Added
- **Signal tool (S)** — drop a signal on the main by clicking; each signal is a **control point** (a block boundary, or an interlocking once you group turnouts under it). Signal masts are now **clickable** — select one to set its direction, side, position, and the turnouts/crossings it governs in the inspector.

## v0.15.16 — 2026-07-19

### Changed
- **A new module opens blank** — just the board, no track. **Geometry is gone from the new-module form**; you draw the mainline on the canvas (Track tool — click one end of the board, then the other), then build up the layers: track, turnouts, signals, industries. Existing modules (which carry a geometry) are unchanged.

## v0.15.15 — 2026-07-19

### Added
- **Benchwork sections** — set how many bench-work **sections** a module is built from (in the Module panel with nothing selected). The joints where the boards split are drawn as dashed dividers across the board, marked with their position. The module still operates as one unit — the joints are just construction/transport seams.

## v0.15.14 — 2026-07-19

### Fixed
- **Drop a turnout on a spur** — with the **W** tool, clicking a spur now drops a turnout on it instead of just selecting the spur, so house-track turnouts work again.

## v0.15.13 — 2026-07-19

### Added
- **Multi-track industries (house tracks)** — one industry can now be served by **several tracks**. In an industry's inspector there's a **House-track spots** section: add a spot on another track (its own span), and it draws on the layout beside that track. Capacity totals across all the industry's tracks. Clicking any of its tracks selects the whole industry.

## v0.15.12 — 2026-07-19

### Changed
- **Curved turnouts** — on a curved mainline, a turnout's diverging leg now **follows the curve** (a smooth arc easing out to one track over at the frog) instead of poking out as a straight chord, so the whole switch reads as one curved piece. Straight-main turnouts are unchanged.

## v0.15.11 — 2026-07-19

### Added
- **Turnouts on a spur (house tracks)** — the **W** tool now drops a turnout onto the nearest track, so you can put one **on a spur**, not just the main. Then draw another spur from it — the switch's frog geometry follows the track it sits on. This is how an industry's **house track** branches to multiple spot tracks.

## v0.15.10 — 2026-07-18

### Changed
- **Cleaner track & switches** — track now draws as a simple **outlined band** with **no ties**, and a turnout shows its **points and frog** through the band geometry with small node markers instead of the old triangle symbols.

## v0.15.9 — 2026-07-18

### Changed
- **Turnouts look like switches** — a turnout now draws its diverging leg as real **ballasted track** (rails + ties) running from the throat, with a **frog** casting and **points** symbol, instead of a plain line. The whole switch-and-spur reads as one continuous piece of track.

## v0.15.8 — 2026-07-18

### Changed
- **Spurs start at the frog** — a drawn spur now begins at its turnout's **frog** point, so the switch's diverging rail and the spur read as **one continuous route** instead of two lines leaving the throat. (Fixes the stray extra line that appeared next to a drawn spur.)

## v0.15.7 — 2026-07-18

### Changed
- **Turnouts draw as switches** — a turnout that a spur or siding diverges from now shows its **frog rail** leaving the main at the real frog angle (from its #), on the correct hand/side, instead of a bare dot. Higher numbers diverge more gently. (A turnout with nothing diverging yet stays a marker until you draw a track from it.)

## v0.15.6 — 2026-07-18

### Fixed
- **Drag a drawn spur to resize or reorient it** — a spur/siding you drew is now grab-and-drag editable with the **Select** tool too, not only the Track tool. Select it and drag its stub end to lengthen, shorten, or swing it; its throat stays on the turnout.

## v0.15.5 — 2026-07-18

### Added
- **Turnout tool (W)** — drop a turnout on the main by clicking. Pick its **number (frog size)** — #4 to #10 — in the toolbar first; it shows in the turnout's inspector and saves with the module. Then draw a spur or siding from the turnout with the Track tool.

### Fixed
- **You can extend a spur you just drew** — a freshly drawn spur or siding is now selected, so the Track tool edits *that track* (click the line to add a bend) instead of accidentally bending the mainline and breaking it.

## v0.15.4 — 2026-07-18

### Changed
- **Draw sidings & spurs from a turnout** — a siding or spur now diverges from a **turnout** you place on the main first, instead of dropping at a default spot. Place a turnout, then pick **Spur** and drag out from it to the stub, or pick **Siding** and drag from one turnout to another. The **+ Track** menu keeps Spur/Siding disabled until enough turnouts exist (one for a spur, two for a siding). **Esc** or **Cancel** aborts; shape the track with the Track tool afterwards.

## v0.15.3 — 2026-07-18

### Changed
- **One Track tool** — the Mainline (M) and Track (T) tools are now a single **Track (T)** tool. With nothing selected you draw and bend the mainline; click a siding or spur to bend/rotate it. Press **Esc** to deselect and go back to the mainline. The separate M tool is gone.

### Fixed
- **Clear now clears everything** — the drawn/curved mainline and any industries used to survive a Clear; they're wiped too. (The mainline collapses back to a plain straight line — the module's baseline — since positions are measured along it.)

## v0.15.2 — 2026-07-18

### Changed
- **"+ Track" menu on the drawing tools** — the add-track menu (set the main to single/double, add a siding or spur/yard, a crossover) now appears in the toolbar above the canvas whenever the **Mainline** or **Track** tool is active, so you add and draw track in the same place. It's still in the Objects list too.

## v0.15.1 — 2026-07-18

### Changed
- **Tool rail grouped by job** — the left rail now reads in sections: **Select**, then everything you draw on the board (**Benchwork · Mainline · Track · Turnout · Signal**), then **Industry**. Turnout and Signal sit with the track tools instead of below Industry.

### Removed
- **"Mainline length" field** — gone from the module inspector, the new-module wizard, and the edit form. A module whose rail runs a different distance than its board is now expressed by **drawing the mainline** (the **M** tool), not by typing a second length.

## v0.15.0 — 2026-07-18

### Changed
- **One "+ Track" menu** — add track from a single menu: set the mainline to single or double track, or add a siding or spur/yard (and a crossover on a double main).

## v0.14.1 — 2026-07-18

### Fixed
- **Both endplates follow a drawn mainline** — curving the mainline now rotates endplate A as well as B to match the track at each end.
- **Remove drawn points** — Alt-click a mainline or spur point to delete it; a **Straighten** / **Un-draw** button resets a drawn path back to derived.

### Added
- **Save button** — save now on demand (changes still autosave).

## v0.14.0 — 2026-07-18

### Added
- **Draw sidings & spurs** — the **T** tool: select a siding/spur, then drag its points to bend or rotate it (◇ to curve), or click to add a bend. The throat stays snapped to its turnout. The dispatcher view is unchanged.

## v0.13.0 — 2026-07-18

### Added
- **Draw the mainline** — a new **M** tool: drag mainline points, bend a stretch into a curve (drag its ◇), or click the line to add a bend. The board and endplate B follow the shape you draw; the dispatcher view stays straightened. The length/geometry fields seed the initial path.

## v0.12.1 — 2026-07-18

### Fixed
- **Saving a module with industries no longer errors** — removing a track was blocked when an industry still pointed at it; the save now re-points industries first, then cleans up tracks.

## v0.12.0 — 2026-07-18

### Added
- **Linked dispatcher view** — select a track, turnout or crossing on the board and it lights up in the dispatcher strip below, so the physical-to-dispatcher mapping is visible.

## v0.11.2 — 2026-07-18

### Added
- **Industry tool** — the left-rail **I** tool (or key `I`): click a track to drop an industry there.
- **Suggest a car type** — request a car type that isn't in the list yet, right from an industry's inspector.

## v0.11.1 — 2026-07-18

### Added
- **Car types per industry** — pick which cars each industry receives (boxcar, hopper, tank…) in its inspector; they load and save with the module.

## v0.11.0 — 2026-07-18

### Added
- **Industries on the canvas** — place a rail-served customer as a car-spot span on a track (name, type, side, span). Capacity in cars derives from the span; a name + optional car/length label draws on the board. Existing industries load in ready to position; a new **Industries** step appears in the readiness checklist.

## v0.10.0 — 2026-07-17

### Changed
- **Track looks like track** — a ballast band with two rails and ties once you zoom in, a clean single line at overview.
- **The board reads as a board** — a solid fill the track sits on, with the endplate faces hatched to show the standard interface.
- **Signals are masts** — a mast on the track it governs with a head, instead of a bare dot.

## v0.9.0 — 2026-07-17

### Added
- **Quick new-module** — name, category, geometry and length, then straight to the canvas with a board already drawn. The full step-by-step wizard is still one click away.

### Changed
- **New modules open on a seeded board** instead of an empty canvas with a button.
- **Track capacity shows car count** (≈40 ft cars) alongside scale feet, and is always derived from the drawn length — never typed.

## v0.8.0 — 2026-07-17

### Added
- **Tool rail** down the left — Select (V) and Benchwork (B), with single-key shortcuts. More tools are stubbed for later.
- **Undo / redo** — Ctrl+Z and Ctrl+Shift+Z, with rapid drags folded into one step.
- **Autosave** — changes save automatically about a second after you stop; the Save button is gone, replaced by a Saved / Saving / Unsaved indicator.

### Changed
- **Clear** now asks first, and empties the drawing (autosave persists it).

## v0.7.0 — 2026-07-17

### Added
- **Drafting grid** — an inch grid that adapts as you zoom, with rulers down the top and left edges (origin at endplate A).
- **Zoom & pan** — scroll to zoom toward the pointer, space-drag to pan, Fit to frame the board; the view no longer jumps every time you edit.
- **Dimension callouts** — the board's overall length and depth are marked automatically, in inches and feet.
- **Live measurements** — dragging a corner, turnout or siding end shows its position/length (with a car count) as you move it.
- **Status bar** — board size, grid step, zoom and pointer position along the bottom.

## v0.6.0 — 2026-07-16

### Changed
- **The canvas is now the editor** — full-height board in the middle, one inspector on the right. The form stack and the stage rail are gone.
- **Nothing selected shows the module** — geometry, lengths and loop settings live in the inspector.
- **Endplates are objects** — click one on the board to set its track config, face width and pose.
- **Objects list** — every track, turnout, crossing and control point in one place; click to select, and it highlights on the board.
- **Dispatcher view moved to a strip** at the bottom (it's derived, so it no longer takes a column from the board).
- **Readiness replaces the stage gate** — a checklist in the top bar says what's missing instead of hiding fields.

### Fixed
- **Track under the benchwork is clickable again** — the board's shading sat on top of the track and swallowed every click, so turnouts, signals and endplates couldn't be selected or dragged on any module with an outline drawn.
- **Clicking empty canvas no longer adds a benchwork corner** — the Select tool means select; the Benchwork tool draws.

## v0.5.0 — 2026-07-14

### Added
- **Endplate face width** — set each endplate's face width (12″ min, 24″ recommended); ends may differ.
- **Benchwork outline** — draw the module's real board shape; corners snap to the endplate faces (◆). Empty = plain endplate-width band.
- **Curved edges** — drag an edge's ◇ to bow it into an arc.
- **Physical module view** — module pages and catalog cards now show the board and track to scale, beside the dispatcher schematic.
- **In-app changelog** — this page, plus a note after login when there's something new.

### Changed
- **Benchwork editor is a full-width canvas** of the real module — mainline, sidings, turnouts and signals drawn where they actually sit.
- **Place track by dragging** — drag a turnout (●) or a siding's ends (○) along the main. Numeric fields still available.
- **Click to edit** — select a turnout or track on the canvas to edit it in place.
- **Build order** — the builder now runs Dimensions → Benchwork → Track → Operations, one stage at a time. Jump freely; nothing is locked.
- **Dimensions live in the builder** — geometry and lengths reshape the board as you type. One Save writes both.

### Fixed
- Builder uses the full window instead of a narrow column.
- Changelog entries no longer cut off mid-sentence.

---

## v0.4.0 — 2026-06-28

### Added
- **Decimal inch length entry** — module length is now entered as a single total-inches
  decimal field (e.g. `48.5`) instead of separate feet + inches boxes. Supports three
  decimal places.
- **Mainline track length** — optional second length field for modules where the rail
  distance through the module differs from the physical footprint (curves, wyes, etc.).
  Helper text explains when to use it. The detail page only shows the mainline length
  when it differs from the module footprint.
- **Custom endplate labels** — endplate label field added to the new-module wizard and
  the add/edit endplate forms. Leave blank to auto-assign EP-1, EP-2, etc.; enter a
  direction (e.g. "West", "East") for a custom label. Maximum 30 characters.

### Changed
- **MSS wording** — "Has a Modular Signal System (MSS)" changed to "Supports Modular
  Signal System (MSS)" throughout the wizard and edit form.
- **Image upload reliability** — filenames with spaces or special characters no longer
  cause a server error; they are sanitised before upload. Upload failures now surface an
  error message to the user instead of silently failing.

### Database
- `freemon_modules`: `length_feet` (SMALLINT) and `length_inches` (SMALLINT) replaced
  by `length_total_inches` (DECIMAL 7,3) and `mainline_length_inches` (DECIMAL 7,3).
  Existing rows were converted automatically (`feet × 12 + inches`).
- `freemon_endplates`: label `CHECK` constraint widened from the previous limit to 30
  characters. The auto-assign trigger now fires on `INSERT` only and only when the label
  is blank, so custom labels are preserved on subsequent edits.

---

## v0.3.0 — 2026-06-25

### Added
- **File uploads up to 10 MB** — the Next.js server-action body-size limit was raised
  from the default ~1 MB to 10 MB.
- **Email confirmation on sign-up** — new registrations now show a "Check your email"
  screen instead of redirecting straight to the dashboard.
- **Curve degree precision** — `geometry_degrees` now accepts 1–359 degrees with up to
  three decimal places (previously unconstrained with two decimal places).
- **CAD / schematic attachments** — module owners can upload track-plan files (DWG, DXF,
  AnyRail, SCARM, XTrackCAD, Templot, RailModeller, 3PlanIt, PDF) and download them from
  the module detail page.

---

## v0.2.0 — 2026-06-18

### Added
- Module tracks (spurs and sidings) with capacity, linked to industries.
- MSS module type field (Crossover / Cascade).
- Owner profile: first/last name, phone number.
- Admin panel: suggestion review, lookup management, grants, user management, audit log.

---

## v0.1.0 — 2026-06-10

- Initial release (M1–M4).
- Authentication and user management.
- Module CRUD with new-module wizard.
- Endplates, industries, and image gallery.
- Module catalog with search and filtering.
