# Open Knowledge Format (OKF v0.2) Markdown Contract

Every meeting session or topic note is stored as plain Markdown (`.md`) with deterministic YAML frontmatter and `[[wiki-links]]`:

```markdown
---
okf_version: "0.2"
id: "session/2026-11-18-architecture-review"
type: "meeting"
doc_type: "meeting_minutes"
title: "Architecture Review"
date: "2026-11-18"
speakers: ["Maya Lin", "Alex Rivera"]
tags: ["architecture", "local-first"]
---

# Architecture Review

## Decisions
- Store canonical meeting memory as editable local Markdown in [[topics/local-wiki]].

## Action Items
- [ ] @alex Run `npx okf-markdown validate ./vault` in pre-commit hook
```

## Related Resources

- [OneMira Local Wiki Documentation](https://onemira.com/docs/daily-use/local-wiki)
- [No-Subscription Local AI Voice Recorder Architecture](https://onemira.com/ai-voice-recorder-without-subscription)
- [OKF Meeting Templates](https://onemira.com/meeting-minutes-templates)
