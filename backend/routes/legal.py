"""
Public legal endpoints — served as clean, self-contained HTML so a
Google Play Console `Privacy policy URL` field can point directly at
`https://<deployed-host>/api/legal/privacy`.

These are intentionally kept dependency-free (no templates, no DB) so
they are cheap, cache-friendly, and cannot fail from a data outage.

Endpoints:
    GET /api/legal/privacy   — Privacy Policy
    GET /api/legal/terms     — Terms of Service
    GET /api/legal           — Index page linking to both
"""
from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(prefix="/api/legal", tags=["legal"])


# --- Shared HTML shell (dark, mobile-first, brand-matching) -----------
def _shell(title: str, body_html: str) -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="index,follow"/>
<title>{title} — Time Loop Escape</title>
<style>
  :root {{
    --bg: #0A0B10; --panel: #12142A; --cyan: #00E5FF; --purple: #9D00FF;
    --text: #E8EDF5; --muted: #8B95B0; --line: rgba(0,229,255,0.15);
  }}
  * {{ box-sizing: border-box; }}
  html,body {{ margin:0; padding:0; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 16px; line-height: 1.65; -webkit-font-smoothing: antialiased; }}
  .wrap {{ max-width: 780px; margin: 0 auto; padding: 48px 24px 120px; }}
  header {{ border-bottom: 1px solid var(--line); padding-bottom: 20px; margin-bottom: 32px; }}
  h1 {{ font-size: 32px; letter-spacing: 2px; margin: 0 0 6px; color: #fff; font-weight: 900; }}
  h1 .esc {{ color: var(--cyan); }}
  .brand {{ color: var(--muted); font-size: 13px; letter-spacing: 2px; text-transform: uppercase; }}
  h2 {{ color: var(--cyan); font-size: 20px; letter-spacing: 1px; margin: 36px 0 12px; font-weight: 800; }}
  h3 {{ color: #fff; font-size: 16px; margin: 20px 0 8px; }}
  p, li {{ color: var(--text); }}
  strong {{ color: #fff; }}
  em, .muted {{ color: var(--muted); font-style: normal; }}
  ul {{ padding-left: 22px; }}
  li {{ margin-bottom: 6px; }}
  a {{ color: var(--cyan); text-decoration: none; }}
  a:hover {{ text-decoration: underline; }}
  code {{ background: rgba(0,229,255,0.08); padding: 2px 6px; border-radius: 4px; color: var(--cyan); font-size: 14px; }}
  .pill {{ display: inline-block; padding: 4px 12px; border-radius: 12px;
    background: rgba(157,0,255,0.15); border: 1px solid var(--purple);
    color: #E0A0FF; font-size: 12px; letter-spacing: 1.5px; margin-bottom: 20px; }}
  footer {{ margin-top: 60px; padding-top: 24px; border-top: 1px solid var(--line);
    color: var(--muted); font-size: 13px; }}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="brand">Time Loop <span style="color:var(--cyan)">Escape</span></div>
    <h1>{title}</h1>
    <span class="pill">Updated · June 2026</span>
  </header>
  {body_html}
  <footer>
    Time Loop Escape · A neon puzzle platformer · Published on Google Play<br/>
    Legal: <a href="/api/legal/privacy">Privacy Policy</a> · <a href="/api/legal/terms">Terms of Service</a>
  </footer>
</div>
</body>
</html>"""


# --- Content ----------------------------------------------------------
_PRIVACY_BODY = """
<p>Time Loop Escape (&ldquo;the App&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) respects your privacy.
This policy explains what data the App collects, why it collects it, and how it is stored.</p>

<h2>1. Data we do NOT collect</h2>
<p>Time Loop Escape is a <strong>fully offline single-player game</strong>. We do not collect,
transmit, or store on any server:</p>
<ul>
  <li>Personal information (name, email address, phone number).</li>
  <li>Contacts, photos, camera, microphone, or location data.</li>
  <li>Analytics identifiers, advertising IDs, or third-party trackers.</li>
  <li>Any information that could identify you personally.</li>
</ul>

<h2>2. Data we DO store — locally, on your device only</h2>
<p>The following gameplay data is saved on-device using Android&rsquo;s private
<code>AsyncStorage</code> sandbox. It never leaves your device unless you opt-in to a
future cloud-save feature (currently not enabled):</p>
<ul>
  <li>Level completion state (which levels are cleared, their grades and stars).</li>
  <li>Lifetime statistics (total playtime, deaths, echoes used, fastest clear time).</li>
  <li>Settings preferences (music/SFX on/off, haptics, one-thumb mode, screen-shake, colour-safe palette, selected skin).</li>
  <li>Unlocked skins and earned achievements.</li>
</ul>
<p>You can wipe all of the above at any time via <strong>Settings &rarr; Reset Progress</strong>.</p>

<h2>3. Permissions</h2>
<p>Time Loop Escape declares only the minimum Android permissions required to run:</p>
<ul>
  <li><strong>VIBRATE</strong> &mdash; for haptic feedback on jumps, deaths, and rewinds. Can be turned off in Settings.</li>
</ul>
<p>No network permissions are required for gameplay. The App does not open sockets or make
outbound requests during play. Standard Android runtime libraries may still perform routine
system checks; no gameplay data is transmitted through them.</p>

<h2>4. Children&rsquo;s privacy</h2>
<p>The App is rated for everyone and contains no advertising, in-app purchases, chat,
user-generated content, or social features. It complies with Google Play&rsquo;s Families policy
and is safe for players of all ages.</p>

<h2>5. Third-party services</h2>
<p>No third-party analytics, advertising, or crash-reporting services are integrated in the
current release. Should any be added in a future version, this policy will be updated and a
clear in-app notice shown before any data leaves your device.</p>

<h2>6. Data retention &amp; deletion</h2>
<p>Because no data is collected on our servers, there is nothing for us to retain or delete
about you. Any local data can be removed instantly by uninstalling the App or by using
<strong>Settings &rarr; Reset Progress</strong>.</p>

<h2>7. Changes to this policy</h2>
<p>Any changes will be announced in the release notes on the Google Play Store and reflected
on this page. Continued use of the App after an update constitutes acceptance of the updated
policy.</p>

<h2>8. Contact</h2>
<p>For any questions or concerns about this Privacy Policy, please contact:
<br/><a href="mailto:support@timeloopscope.game">support@timeloopscope.game</a></p>
"""

_TERMS_BODY = """
<p>By downloading, installing, or using Time Loop Escape (&ldquo;the App&rdquo;), you agree to
these Terms of Service. If you do not agree, please do not use the App.</p>

<h2>1. License</h2>
<p>We grant you a personal, non-transferable, non-exclusive licence to install and play the
App on Android devices you own or control, solely for personal, non-commercial entertainment.</p>

<h2>2. Restrictions</h2>
<ul>
  <li>You may not reverse-engineer, decompile, or disassemble the App except as permitted by law.</li>
  <li>You may not distribute modified copies of the App or its assets.</li>
  <li>You may not use the App for any illegal purpose.</li>
</ul>

<h2>3. Intellectual property</h2>
<p>All artwork, code, level designs, music, sound effects, and other content in the App are
owned by the developer and protected by copyright, trademark, and other applicable laws.</p>

<h2>4. Disclaimer of warranties</h2>
<p>The App is provided <strong>&ldquo;as is&rdquo;</strong> without warranty of any kind. We do
not guarantee that the App will always be available, error-free, or compatible with every
device configuration.</p>

<h2>5. Limitation of liability</h2>
<p>To the maximum extent permitted by applicable law, we shall not be liable for any indirect,
incidental, special, consequential, or punitive damages arising from your use of the App.</p>

<h2>6. Changes to these terms</h2>
<p>We may revise these terms from time to time. Continued use of the App after such changes
constitutes your acceptance of the new terms.</p>

<h2>7. Governing law</h2>
<p>These terms are governed by the laws of India, without regard to conflict-of-law principles.
Any dispute shall be subject to the exclusive jurisdiction of the courts located in India.</p>

<h2>8. Contact</h2>
<p>For questions about these Terms of Service, please contact:
<br/><a href="mailto:support@timeloopscope.game">support@timeloopscope.game</a></p>
"""

_INDEX_BODY = """
<p>Welcome to the legal information hub for <strong>Time Loop Escape</strong>.</p>
<ul>
  <li><a href="/api/legal/privacy"><strong>Privacy Policy</strong></a> &mdash; what data the game does and does not collect.</li>
  <li><a href="/api/legal/terms"><strong>Terms of Service</strong></a> &mdash; the rules for using the game.</li>
</ul>
<p class="muted">All game data is stored locally on your device. Nothing is transmitted to any server.</p>
"""


@router.get("/privacy", response_class=HTMLResponse)
async def privacy_policy() -> HTMLResponse:
    return HTMLResponse(_shell("Privacy Policy", _PRIVACY_BODY))


@router.get("/terms", response_class=HTMLResponse)
async def terms_of_service() -> HTMLResponse:
    return HTMLResponse(_shell("Terms of Service", _TERMS_BODY))


@router.get("", response_class=HTMLResponse)
async def legal_index() -> HTMLResponse:
    return HTMLResponse(_shell("Legal", _INDEX_BODY))
