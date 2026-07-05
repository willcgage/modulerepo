import type { Metadata } from "next";
import Image from "next/image";
import s from "./help.module.css";

export const metadata: Metadata = {
  title: "Help & User Guide — Module Repository",
  description: "How to register, create modules, and manage your Free-moN module catalog.",
};

const VERSION = "0.2.0";

function Screenshot({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure className={s.screenshot}>
      <Image src={src} alt={alt} width={1280} height={800} style={{ width: "100%", height: "auto" }} unoptimized />
      {caption && <figcaption className={s.screenshotCaption}>{caption}</figcaption>}
    </figure>
  );
}

export default function HelpPage() {
  return (
    <div className={s.pageRoot}>
      {/* HEADER */}
      <header className={s.siteHeader}>
        <div className={s.siteHeaderBrand}>
          <div className={s.eyebrow}>Free-moN</div>
          <h1>Module Repository</h1>
        </div>
        <div className={s.headerRule} />
        <span className={s.headerTag}>User Guide · v{VERSION}</span>
      </header>

      <div className={s.pageWrap}>
        {/* SIDEBAR TOC */}
        <nav className={s.toc} aria-label="Table of contents">
          <div className={s.tocTitle}>Contents</div>
          <ul className={s.tocList}>
            <li><a href="#getting-started">Getting Started</a></li>
            <li><a href="#dashboard">Your Dashboard</a></li>
            <li><a href="#creating-module">Creating a Module</a></li>
            <li><a href="#wizard-step1" className={s.tocSub}>Step 1 — Basics</a></li>
            <li><a href="#wizard-step2" className={s.tocSub}>Step 2 — Endplates</a></li>
            <li><a href="#wizard-step3" className={s.tocSub}>Step 3 — Tracks</a></li>
            <li><a href="#wizard-step4" className={s.tocSub}>Step 4 — Industries</a></li>
            <li><a href="#wizard-step5" className={s.tocSub}>Step 5 — Schematic</a></li>
            <li><a href="#module-detail">Managing a Module</a></li>
            <li><a href="#images">Images &amp; Schematics</a></li>
            <li><a href="#editing">Editing Basics</a></li>
            <li><a href="#profile">Your Profile</a></li>
            <li><a href="#admin">Admin Reference</a></li>
            <li><a href="#glossary">Glossary</a></li>
          </ul>
        </nav>

        {/* MAIN CONTENT */}
        <main className={s.mainContent}>

          {/* INTRO */}
          <div className={s.introCard}>
            <p>The <strong>Module Repository</strong> is the central catalog for Free-moN modules. If you&apos;ve built a Free-moN module, this is where you register it — recording its geometry, endplates, track, industries, and CAD drawings — so it can be found, scheduled, and planned by show organizers and Free Dispatcher.</p>
          </div>

          {/* GETTING STARTED */}
          <section className={s.section} id="getting-started">
            <div className={s.sectionEyebrow}>First time here</div>
            <h2 className={s.sectionTitle}>Getting Started</h2>

            <ul className={s.stepList}>
              <li className={s.stepItem}>
                <div className={s.stepNum}>1</div>
                <div className={s.stepBody}>
                  <strong>Create an account</strong>
                  <p>Click <em>Register</em> on the login page and enter your display name, email, and a password. Your display name is what other users and show organizers see.</p>
                </div>
              </li>
              <li className={s.stepItem}>
                <div className={s.stepNum}>2</div>
                <div className={s.stepBody}>
                  <strong>Confirm your email</strong>
                  <p>After registering, check your inbox for a confirmation email. Click the link inside — your account isn&apos;t active until you do. Check spam if it doesn&apos;t arrive within a few minutes.</p>
                </div>
              </li>
              <li className={s.stepItem}>
                <div className={s.stepNum}>3</div>
                <div className={s.stepBody}>
                  <strong>Log in</strong>
                  <p>Sign in with your email and password. If you forget your password, use <em>Forgot your password?</em> on the login page.</p>
                </div>
              </li>
              <li className={s.stepItem}>
                <div className={s.stepNum}>4</div>
                <div className={s.stepBody}>
                  <strong>Add your first module</strong>
                  <p>From the Dashboard, go to <em>My modules</em> → <em>+ New module</em> and follow the five-step wizard.</p>
                </div>
              </li>
            </ul>

            <Screenshot src="/help/login.png" alt="Login page" caption="Sign in or use the Register link to create a new account" />
            <Screenshot src="/help/register.png" alt="Registration page" caption="Fill in your display name, email, and password to create an account" />
          </section>

          {/* DASHBOARD */}
          <section className={s.section} id="dashboard">
            <div className={s.sectionEyebrow}>Navigation</div>
            <h2 className={s.sectionTitle}>Your Dashboard</h2>
            <p>The Dashboard is your home base. It shows your display name, email, and role, and links to the main areas of the app.</p>

            <div className={s.overflowX}>
              <table className={s.fieldTable}>
                <thead>
                  <tr><th>Link</th><th>What it does</th></tr>
                </thead>
                <tbody>
                  <tr><td><strong>My modules</strong></td><td>List of every module you own. Click any module to open its detail page.</td></tr>
                  <tr><td><strong>Edit profile</strong></td><td>Update your contact info, first/last name, phone, and location.</td></tr>
                  <tr><td><strong>Admin</strong></td><td>Only visible if your account has the <em>admin</em> role. See the Admin reference section below.</td></tr>
                </tbody>
              </table>
            </div>

            <Screenshot src="/help/dashboard.png" alt="Dashboard" caption="Your dashboard showing navigation links and account details" />
          </section>

          {/* CREATING A MODULE */}
          <section className={s.section} id="creating-module">
            <div className={s.sectionEyebrow}>The wizard</div>
            <h2 className={s.sectionTitle}>Creating a Module</h2>
            <p>Click <em>+ New module</em> from the modules list to open the five-step wizard. You can go back to any previous step at any time before submitting. The module is only saved when you complete Step 5.</p>

            <div className={`${s.callout} ${s.calloutInfo}`} style={{ marginTop: 0 }}>
              <strong>Required fields are marked below.</strong> Everything else is optional but makes your module more useful to show organizers and Free Dispatcher.
            </div>

            <Screenshot src="/help/modules-list.png" alt="Modules list page" caption="Your modules list — click + New module to start the wizard" />

            {/* STEP 1 */}
            <div className={s.wizardStep} id="wizard-step1">
              <div className={s.wizardStepHeader}>
                <div className={s.wizardStepNum}>1</div>
                <div className={s.wizardStepName}>Basics</div>
              </div>
              <div className={s.wizardStepBody}>
                <p>Core identity and physical dimensions of the module.</p>
                <div className={s.overflowX}>
                  <table className={s.fieldTable}>
                    <thead><tr><th>Field</th><th></th><th>Notes</th></tr></thead>
                    <tbody>
                      <tr>
                        <td><strong>Module name</strong></td>
                        <td><span className={s.req}>Required</span></td>
                        <td>A unique name for your module. The wizard checks availability as you type. Max 120 characters.</td>
                      </tr>
                      <tr>
                        <td><strong>Description</strong></td>
                        <td><span className={s.opt}>Optional</span></td>
                        <td>A brief description of the scene, era, or character of the module.</td>
                      </tr>
                      <tr>
                        <td><strong>Category</strong></td>
                        <td><span className={s.req}>Required</span></td>
                        <td>The operational classification (e.g. <em>team track</em>, <em>industrial</em>). Managed by an admin in the Lookup tables.</td>
                      </tr>
                      <tr>
                        <td><strong>Geometry</strong></td>
                        <td><span className={s.req}>Required</span></td>
                        <td>The shape of the module — straight, corner, wye, etc.</td>
                      </tr>
                      <tr>
                        <td><strong>Curve degrees</strong></td>
                        <td><span className={s.opt}>Conditional</span></td>
                        <td>Only appears when the geometry requires it (e.g. a corner module). Enter 1–359 degrees, up to three decimal places.</td>
                      </tr>
                      <tr>
                        <td><strong>Offset (inches)</strong></td>
                        <td><span className={s.opt}>Conditional</span></td>
                        <td>Only appears when the geometry requires it.</td>
                      </tr>
                      <tr>
                        <td><strong>Module footprint length (inches)</strong></td>
                        <td><span className={s.req}>Required</span></td>
                        <td>The straight-line, end-to-end length of the physical module board. Enter in decimal inches (e.g. <code>48</code> or <code>54.5</code>).</td>
                      </tr>
                      <tr>
                        <td><strong>Mainline track length (inches)</strong></td>
                        <td><span className={s.opt}>Optional</span></td>
                        <td>The actual length of rail running through the module. <strong>Leave blank if it equals the footprint</strong> — that&apos;s the common case for straight modules. Enter a value only when the rail path is longer or shorter than the footprint, such as on a curve or wye where the track sweeps through a longer arc.</td>
                      </tr>
                      <tr>
                        <td><strong>Supports MSS</strong></td>
                        <td><span className={s.opt}>Optional</span></td>
                        <td>Check if the module is wired for the Modular Signal System. A second field appears for the MSS type (Crossover or Cascade).</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <Screenshot src="/help/wizard-step1.png" alt="Wizard Step 1 — Basics" caption="Step 1: fill in the module name, category, geometry, and length" />
              </div>
            </div>

            {/* STEP 2 */}
            <div className={s.wizardStep} id="wizard-step2" style={{ marginTop: 16 }}>
              <div className={s.wizardStepHeader}>
                <div className={s.wizardStepNum}>2</div>
                <div className={s.wizardStepName}>Endplates</div>
              </div>
              <div className={s.wizardStepBody}>
                <p>An endplate is one end of the module — the face that joins to the next module at a show. Add one row per endplate. Most straight modules have two.</p>
                <div className={s.overflowX}>
                  <table className={s.fieldTable}>
                    <thead><tr><th>Field</th><th></th><th>Notes</th></tr></thead>
                    <tbody>
                      <tr>
                        <td><strong>Label</strong></td>
                        <td><span className={s.opt}>Optional</span></td>
                        <td>A name for this end — e.g. <code>West</code>, <code>East</code>, <code>North</code>. If left blank, it auto-assigns <code>EP-1</code>, <code>EP-2</code>, etc. Max 30 characters.</td>
                      </tr>
                      <tr>
                        <td><strong>Track configuration</strong></td>
                        <td><span className={s.req}>Required</span></td>
                        <td><em>Single</em> or <em>Double</em> mainline track at this endplate.</td>
                      </tr>
                      <tr>
                        <td><strong>Width (inches)</strong></td>
                        <td><span className={s.req}>Required</span></td>
                        <td>The width of the endplate in inches, to two decimal places.</td>
                      </tr>
                      <tr>
                        <td><strong>Height (inches)</strong></td>
                        <td><span className={s.opt}>Optional</span></td>
                        <td>Leave blank for a module at standard grade (no change in elevation).</td>
                      </tr>
                      <tr>
                        <td><strong>Notes</strong></td>
                        <td><span className={s.opt}>Optional</span></td>
                        <td>Any special connection notes for this end. Max 255 characters.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p>Click <em>+ Add endplate</em> to add more rows. Use <em>Remove</em> to delete one. Give each endplate a meaningful label such as &ldquo;West&rdquo; or &ldquo;East&rdquo; — the label appears on the module detail page and in Free Dispatcher.</p>
                <Screenshot src="/help/wizard-step2.png" alt="Wizard Step 2 — Endplates" caption="Step 2: add one row per endplate and give each a label" />
              </div>
            </div>

            {/* STEP 3 */}
            <div className={s.wizardStep} id="wizard-step3" style={{ marginTop: 16 }}>
              <div className={s.wizardStepHeader}>
                <div className={s.wizardStepNum}>3</div>
                <div className={s.wizardStepName}>Tracks</div>
              </div>
              <div className={s.wizardStepBody}>
                <p>Add a row for each spur or siding on this module. <strong>Don&apos;t add a row for the mainline</strong> — just the branch tracks that serve industries.</p>
                <div className={s.overflowX}>
                  <table className={s.fieldTable}>
                    <thead><tr><th>Field</th><th></th><th>Notes</th></tr></thead>
                    <tbody>
                      <tr>
                        <td><strong>Track name</strong></td>
                        <td><span className={s.opt}>Optional</span></td>
                        <td>A recognizable name, e.g. <em>House Track</em>, <em>Team Track</em>, <em>Grain Elevator Lead</em>. Max 120 characters.</td>
                      </tr>
                      <tr>
                        <td><strong>Capacity (scale feet)</strong></td>
                        <td><span className={s.req}>Required</span></td>
                        <td>How many scale feet of rolling stock this track can hold. This drives car-count planning in Free Dispatcher.</td>
                      </tr>
                      <tr>
                        <td><strong>Notes</strong></td>
                        <td><span className={s.opt}>Optional</span></td>
                        <td>Spotting tips, weight restrictions, etc. Max 500 characters.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className={`${s.callout} ${s.calloutInfo}`}>
                  Track positions and precise lengths are set in the <strong>operations schematic builder</strong> (Step 5). Capacity here is a rough plan — the schematic&apos;s measured length takes over once drawn.
                </div>
                <Screenshot src="/help/wizard-step3.png" alt="Wizard Step 3 — Tracks" caption="Step 3: add one row per spur or siding (not the mainline)" />
              </div>
            </div>

            {/* STEP 4 */}
            <div className={s.wizardStep} id="wizard-step4" style={{ marginTop: 16 }}>
              <div className={s.wizardStepHeader}>
                <div className={s.wizardStepNum}>4</div>
                <div className={s.wizardStepName}>Industries</div>
              </div>
              <div className={s.wizardStepBody}>
                <p>An industry is any shipper or receiver on the module — a grain elevator, a paper mill, a team track, a house car stop. Add one row per industry.</p>
                <div className={s.overflowX}>
                  <table className={s.fieldTable}>
                    <thead><tr><th>Field</th><th></th><th>Notes</th></tr></thead>
                    <tbody>
                      <tr>
                        <td><strong>Industry name</strong></td>
                        <td><span className={s.req}>Required</span></td>
                        <td>The name of the business or facility. Max 120 characters.</td>
                      </tr>
                      <tr>
                        <td><strong>Industry type</strong></td>
                        <td><span className={s.req}>Required</span></td>
                        <td>Choose from the controlled list (managed by an admin in Lookup tables).</td>
                      </tr>
                      <tr>
                        <td><strong>Track</strong></td>
                        <td><span className={s.opt}>Optional</span></td>
                        <td>Which spur or siding serves this industry. Select <em>Mainline</em> if the industry spots directly off the main without a branch.</td>
                      </tr>
                      <tr>
                        <td><strong>Rail car types served</strong></td>
                        <td><span className={s.opt}>Optional</span></td>
                        <td>Toggle the pill buttons for each car type this industry ships or receives. These drive car-card generation in Free Dispatcher.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p style={{ marginTop: 12, fontSize: "0.85rem", color: "var(--mid)" }}>If the car type you need isn&apos;t listed, expand <em>Suggest a new car type</em> — your suggestion is immediately available to you and goes to an admin for broader approval.</p>
                <Screenshot src="/help/wizard-step4.png" alt="Wizard Step 4 — Industries" caption="Step 4: add industries and select the car types they serve" />
              </div>
            </div>

            {/* STEP 5 */}
            <div className={s.wizardStep} id="wizard-step5" style={{ marginTop: 16 }}>
              <div className={s.wizardStepHeader}>
                <div className={s.wizardStepNum}>5</div>
                <div className={s.wizardStepName}>Operations schematic</div>
              </div>
              <div className={s.wizardStepBody}>
                <p>The final step saves the module and takes you straight into the <strong>schematic builder</strong>. Here you draw the mainline, position the tracks you added in Step 3, and place turnouts, control points, and signals.</p>
                <p>The schematic is how Free Dispatcher reads your module for operations planning. You can skip it for now and return later from the module detail page — look for the <em>Build the operations schematic</em> button.</p>
                <Screenshot src="/help/wizard-step5.png" alt="Wizard Step 5 — Schematic intro" caption="Step 5: the wizard completes and launches the schematic builder" />
              </div>
            </div>
          </section>

          {/* MODULE DETAIL */}
          <section className={s.section} id="module-detail">
            <div className={s.sectionEyebrow}>After creation</div>
            <h2 className={s.sectionTitle}>Managing a Module</h2>
            <p>Click any module in your list to open its detail page. This is the main view for everything associated with the module — you can see and edit endplates, tracks, industries, images, and CAD drawings all from here.</p>

            <Screenshot src="/help/module-detail.png" alt="Module detail page" caption="The module detail page showing the operations schematic preview and key facts" />

            <h3>Status</h3>
            <p>Every module has a status, shown as a badge at the top of the detail page. You can change it from the owner sidebar.</p>
            <div className={s.overflowX}>
              <table className={s.fieldTable}>
                <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
                <tbody>
                  <tr>
                    <td><span className={`${s.badge} ${s.badgeActive}`}>Active</span></td>
                    <td>The module is available and visible to show masters and Free Dispatcher.</td>
                  </tr>
                  <tr>
                    <td><span className={`${s.badge} ${s.badgeInactive}`}>Inactive</span></td>
                    <td>The module exists but is not being offered for shows — perhaps under construction or temporarily unavailable.</td>
                  </tr>
                  <tr>
                    <td><span className={`${s.badge} ${s.badgeArchived}`}>Archived</span></td>
                    <td>The module is retired. It stays in the catalog for historical reference but won&apos;t appear in show planning.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>Endplates</h3>
            <p>Endplates can be added, edited, and deleted directly from the module detail page without going through the wizard. Each endplate has its own inline edit form — make changes and click <em>Save</em>.</p>
            <Screenshot src="/help/module-endplates.png" alt="Module endplates section" caption="The endplates section on the module detail page — edit inline or add new ones" />

            <h3>Industries &amp; car types</h3>
            <p>Industries and their associated car types are managed the same way — inline on the detail page. The car-type section within each industry shows checkboxes; check or uncheck and click <em>Save car types</em>.</p>

            <h3>Tracks</h3>
            <p>Tracks are positioned and measured in the schematic builder. From the detail page, use the <em>Manage tracks in the schematic builder →</em> link to open it. The detail page shows a read-only list of track names and capacities.</p>

            <h3>Deleting a module</h3>
            <p>Use the red <em>Delete module</em> link in the owner sidebar. This is permanent — all associated endplates, tracks, industries, images, and schematics are also deleted.</p>
          </section>

          {/* IMAGES & SCHEMATICS */}
          <section className={s.section} id="images">
            <div className={s.sectionEyebrow}>Attachments</div>
            <h2 className={s.sectionTitle}>Images &amp; CAD Drawings</h2>

            <h3>Operations schematic builder</h3>
            <p>The schematic builder is a canvas-based editor accessed from the module detail page or from the end of the wizard. Draw the mainline track, drag spur tracks into position, and add turnouts, signals, and control points. The schematic is the source of truth Free Dispatcher uses to plan car movements on your module.</p>
            <Screenshot src="/help/schematic-editor.png" alt="Operations schematic builder" caption="The schematic builder — draw track, position spurs, add turnouts and signals" />

            <h3>Photos</h3>
            <p>Upload photos of the module from the <em>Images</em> section on the detail page. Accepted: any image format. Maximum file size is 10 MB per file. Add an optional caption to each photo.</p>
            <div className={`${s.callout} ${s.calloutOk}`}>
              <strong>Tip:</strong> Good photos make your module much more useful to show organizers who haven&apos;t seen it in person. Include shots of the module board, the fascia, and the scenic detail.
            </div>

            <h3>CAD drawings</h3>
            <p>Upload track-plan files in the <em>Schematics &amp; CAD drawings</em> section. Accepted formats:</p>
            <div className={s.overflowX}>
              <table className={s.fieldTable}>
                <thead><tr><th>Extension</th><th>Software</th></tr></thead>
                <tbody>
                  <tr><td><code>.dwg</code></td><td>AutoCAD</td></tr>
                  <tr><td><code>.dxf</code></td><td>DXF exchange format</td></tr>
                  <tr><td><code>.any</code></td><td>AnyRail</td></tr>
                  <tr><td><code>.scarm</code></td><td>SCARM</td></tr>
                  <tr><td><code>.xtc</code> / <code>.trk</code></td><td>XTrackCAD</td></tr>
                  <tr><td><code>.box</code></td><td>Templot</td></tr>
                  <tr><td><code>.rmz</code></td><td>RailModeller</td></tr>
                  <tr><td><code>.3pi</code></td><td>3rd PlanIt</td></tr>
                  <tr><td><code>.pdf</code></td><td>PDF scan or export</td></tr>
                </tbody>
              </table>
            </div>
            <p>Files download directly from the module page — click the filename link.</p>
          </section>

          {/* EDITING BASICS */}
          <section className={s.section} id="editing">
            <div className={s.sectionEyebrow}>Corrections</div>
            <h2 className={s.sectionTitle}>Editing Module Basics</h2>
            <p>To change the module name, description, category, geometry, length, or MSS status, click <em>Edit</em> in the owner sidebar. This opens the module basics edit page — the same fields as Step 1 of the wizard. Endplates, industries, and images are <strong>not</strong> edited here; use the inline forms on the detail page.</p>
            <div className={s.callout}>
              <strong>Name availability is re-checked on save.</strong> If you change the module name and the new name is already taken, you&apos;ll see an error and the save won&apos;t complete.
            </div>
          </section>

          {/* PROFILE */}
          <section className={s.section} id="profile">
            <div className={s.sectionEyebrow}>Your account</div>
            <h2 className={s.sectionTitle}>Your Profile</h2>
            <p>Go to <em>Dashboard → Edit profile</em> to update your contact details.</p>
            <div className={s.overflowX}>
              <table className={s.fieldTable}>
                <thead><tr><th>Field</th><th></th><th>Notes</th></tr></thead>
                <tbody>
                  <tr><td><strong>Display name</strong></td><td><span className={s.req}>Required</span></td><td>Shown to other users and show organizers. Max 120 characters.</td></tr>
                  <tr><td><strong>First name</strong></td><td><span className={s.opt}>Optional</span></td><td>Max 60 characters.</td></tr>
                  <tr><td><strong>Last name</strong></td><td><span className={s.opt}>Optional</span></td><td>Max 60 characters.</td></tr>
                  <tr><td><strong>Contact email</strong></td><td><span className={s.opt}>Optional</span></td><td>Defaults to your login email. You can enter a different address for show-related correspondence.</td></tr>
                  <tr><td><strong>Phone</strong></td><td><span className={s.opt}>Optional</span></td><td>Format: (555) 555-5555</td></tr>
                  <tr><td><strong>Location</strong></td><td><span className={s.opt}>Optional</span></td><td>City, region, or club. Helps show organizers know where modules are coming from.</td></tr>
                </tbody>
              </table>
            </div>
            <p>Your role (<em>owner</em> or <em>admin</em>) is shown read-only — it can only be changed by an admin.</p>
          </section>

          {/* ADMIN */}
          <section className={s.section} id="admin">
            <div className={s.sectionEyebrow}>Admin only</div>
            <h2 className={s.sectionTitle}>Admin Reference</h2>
            <p>If your account has the <em>admin</em> role, you&apos;ll see an <em>Admin</em> button on the dashboard. The admin panel has five sections:</p>

            <h3>Car type suggestions</h3>
            <p>When an owner suggests a new car type from the wizard, it appears here for review. Edit the display label if needed, then <em>Approve</em> to publish it to everyone or <em>Reject</em> to discard it. Approved types are immediately available in the wizard&apos;s car-type picker.</p>

            <h3>Users</h3>
            <p>A list of all registered accounts. Promote a trusted owner to <em>admin</em>, or demote an admin back to <em>owner</em>, using the role dropdown. You cannot change your own role — ask another admin.</p>

            <h3>Show master grants</h3>
            <p>A show master grant gives an owner temporary elevated visibility — they can see active modules and industries as a show organizer would, regardless of each module&apos;s owner-visibility settings. Issue a grant by selecting an owner, entering an event name, and setting an optional expiry date. Revoke an active grant with the <em>Revoke</em> button.</p>

            <h3>Lookup tables</h3>
            <p>The controlled lists that populate the wizard&apos;s dropdowns: module categories, geometries, industry types, and module standards. Add new values using the dashed-border form at the bottom of each section. The <em>value</em> (snake_case key) is permanent once created — only the display label can be changed. Delete a value only if nothing references it.</p>

            <h3>Audit log</h3>
            <p>The 100 most recent changes to admin-relevant data. Filter by table and action type using the pill buttons at the top. Expand any entry to see a before/after JSON diff.</p>
          </section>

          {/* GLOSSARY */}
          <section className={s.section} id="glossary">
            <div className={s.sectionEyebrow}>Terminology</div>
            <h2 className={s.sectionTitle}>Glossary</h2>

            <div className={s.glossaryList}>
              {[
                ["Endplate", "The end face of a Free-moN module — the surface that butts against the adjoining module at a show. Each endplate records its track configuration (single or double), width, and height."],
                ["Footprint length", "The straight-line, end-to-end length of the physical module board in inches. Distinct from the mainline track length on curved or wye modules."],
                ["Mainline length", "The actual length of rail running through the module. On a straight module this equals the footprint. On a curve or wye it follows the arc and may differ. Only record it if it differs from the footprint."],
                ["MSS", "Modular Signal System — an inter-club standard for automatic block signaling on modular layouts. A module either supports it (and is wired accordingly) or it doesn't."],
                ["Record number", "A permanent, system-assigned identifier for each module, formatted FMN-XXXX. It appears on the module detail page and in the catalog. You cannot choose or change it."],
                ["Show master", "An owner who has been granted temporary elevated visibility for a specific event. They can view modules and industries the same way a show organizer does, to help plan a show layout."],
                ["Free Dispatcher", "The companion desktop app that reads the Module Repository catalog, builds a session layout from selected modules, and manages operating sessions (train assignments, car cards, authority). The schematic and industry data you enter here is what Free Dispatcher uses."],
                ["Operations schematic", "A visual track diagram specific to this module, drawn in the schematic builder. It shows the mainline, spurs, turnouts, control points, and signals. Free Dispatcher reads it to understand the module's track geometry for operations planning."],
              ].map(([term, def]) => (
                <div key={term} className={s.glossaryItem}>
                  <div className={s.glossaryTerm}>{term}</div>
                  <div className={s.glossaryDef}>{def}</div>
                </div>
              ))}
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
