# Traceframe brand system

Traceframe uses a restrained, modern identity built around depth, asymmetric
layouts and quiet motion. The interface avoids dense dashboards: navigation
lives in a focused rail, secondary information sits in contextual panels, and
content enters with short fades or slides.

## Colour palette

| Token | Hex | Use |
| --- | --- | --- |
| Deep space | `#080A0F` | Primary background |
| Navigation | `#10131A` | Sidebar and raised panels |
| Raised surface | `#0D1016` | Drawers and focused overlays |
| Lens blue | `#7C8DFF` | Primary actions and active navigation |
| Lens blue hover | `#93A1FF` | Interactive hover state |
| Trace mint | `#58D6C7` | Verified and secure states |
| Primary text | `#F5F7FA` | Headings and important content |
| Secondary text | `#9199AA` | Supporting copy |
| Muted text | `#687183` | Metadata and labels |

The logo frames a connected evidence path between source, verification and
target nodes. Four corner brackets communicate controlled scope, while the
blue-to-mint trace expresses provenance and verified movement. The source
asset is `apps/web/public/traceframe-mark.svg`.

Body copy uses a small positive letter spacing (`0.012em`) with larger tracking
on labels and metadata to improve readability in the dark interface. The shared
type hierarchy uses 36px page titles, 18px section titles, 16px body copy and
feature cues, and a 14px floor for eyebrows, labels and metadata. The named
roles keep that hierarchy consistent across every view instead of relying on
isolated font-size utilities.

All actionable controls use a pointer cursor, including links, enabled buttons,
select triggers and options, summaries and connected form labels. Disabled
controls use a not-allowed cursor so their state remains immediately legible.

The unauthenticated landing experience opens with a 1.75-second aperture and
signal-acquisition sequence before revealing the signal-field composition.
Users who prefer reduced motion receive an almost immediate transition.
Credentials live in a compact access dock rather than a conventional
split-screen login card.
