# 🅿️ Idea Garage

**Stop collecting ideas. Start launching them.**

Idea Garage is a free Obsidian plugin for people with too many ideas, or no idea where to start. Park every idea, score it with 8 simple questions, and see **which one to start first**. Every idea gets a ready-made plan.

> _Screenshots coming soon._

## ✨ What it does

- **🚦 Set up my garage:** a 3-minute wizard asks about your skills, time, money, goal and life plan, and what matters most to you right now. Your answers shape how ideas are ranked.
- **📥 Quick idea:** jot an idea into your Idea Inbox in two seconds. Score it later.
- **➕ New idea:** one click creates a folder, an idea card and six ready-made notes (Business Plan, Structure Plan, To Do List, Marketing Plan, Expected Revenue, Lessons Learned).
- **🔢 Score:** answer 8 plain questions from 1 to 5 (*How fast can I launch it? How much could it earn? Does it fit my life?*). The total updates live.
- **🏁 The dashboard** ranks your ideas four ways:
  - **Queue:** your best idea overall
  - **⚡ Easy wins:** fastest and cheapest to launch
  - **💶 Fast revenue:** most likely to bring money in soon
  - **⭐ Gut picks:** ideas you chose on feeling (with your reason written down)
- **🤖 No ideas yet?** The setup wizard copies an AI prompt that already knows your answers. Paste it into ChatGPT, Claude or Gemini.

## 🚀 Getting started

1. Install **Idea Garage** from *Settings → Community plugins → Browse* (or manually, see below).
2. Click the 💡 lightbulb icon in the left sidebar to open the dashboard.
3. Follow the **Getting started** checklist. The first step is the 3-minute setup.

### Commands
- *Idea Garage: Open dashboard*
- *Idea Garage: Set up my garage*
- *Idea Garage: Park a new idea*
- *Idea Garage: Quick idea to inbox*
- *Idea Garage: Score this idea* (when an idea card is open)

### Settings
- Where your ideas live (default: `Ideas`, or `4 Ideas` if you use the Idea Garage vault)
- Your Idea Inbox note (created for you if it doesn't exist)
- How much each of the 8 questions counts

## 🗂️ How your notes look

Everything is plain Markdown in your vault. Each idea is a note with properties like these:

```yaml
type: idea
status: parked          # parked → debating → planned → in progress → live
manual_pick: false      # true = gut pick, always on top
speed: 5                # 1–5, 5 is always the good side
automation: 5
revenue: 2
life_plan_fit: 4
startup_cost: 5
time_to_first_eur: 4
synergy: 3
risk: 4
```

Default score: `speed×3 + automation×3 + revenue×2 + life_plan_fit×2 + startup_cost + time_to_first_eur + synergy + risk` (max 70). Change the weights in settings.

## 🔒 Privacy

Idea Garage works **only inside your vault**. No accounts, no internet connection, no tracking. Your ideas stay yours.

## 💛 Want the whole system?

The plugin is free and complete. If you'd like the full **Idea Garage vault** (a money pot for all your ideas, schedule, automation page, worked examples and an AI helper that lets AI tools work inside your notes), it's here: [Idea Garage on Gumroad](https://tjasas77.gumroad.com/l/idea-garage). It works together with this plugin.

## 🛠️ Manual installation

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/TSMouse/idea-garage/releases).
2. Put them in `<your vault>/.obsidian/plugins/idea-garage/`.
3. Restart Obsidian and enable **Idea Garage** under *Settings → Community plugins*.

## 🧑‍💻 Development

```bash
npm install
npm run dev     # watch mode
npm run build   # production build
```

## About

I built Idea Garage while launching 40 small businesses in one year, starting with €500, all in public. Feedback and ideas are very welcome: open an [issue](https://github.com/TSMouse/idea-garage/issues).

License: [MIT](LICENSE)
