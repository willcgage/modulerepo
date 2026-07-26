# Changelog

All notable changes to the Module Repository, newest first.
Headings are `version — date` (YYYY-MM-DD).

---

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
