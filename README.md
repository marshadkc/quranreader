# Quran Word Reader

An installable web app that teaches non-Arabic speakers to understand the Quran directly while reading.
All 114 sūrahs can be read and searched; the learning course covers the whole Quran.

- **Reader:** every word sits in its own box with its English and Urdu meaning under it. Prefixes and endings are coloured, and tapping a word shows its parts, base word and root. Each meaning fades as you learn the word, until you read plain Arabic.
- **Sūrah list:** every sūrah in a sidebar on the left (a drawer on phones), with a filter by name or number.
- **Search:** go straight to any āyah by sūrah and number, or search an Arabic word to see its root, every base word and spelling built from it with how often each occurs, and every āyah where they appear.
- **Practice:** a quick quiz per sūrah. Words you know least, and words that appear most often, come first.
- **Word parts:** the small attachments (وَ، فَ، بِ، لِ، ال، ـهُم …) with their meanings and how often they appear.
- **Ayah Honeycomb:** the review game for the whole juz. An āyah's words zig-zag from the right edge of the honeycomb to the left; reveal each word in reading order and choose its meaning. Right answers fill with honey.
- **Root meanings:** the word card gives each root's deep meaning in English and Urdu, and a list of classical dictionaries (Maqāyīs, al-Mufradāt, Lisān al-ʿArab, al-Ṣiḥāḥ, al-Qāmūs al-Muḥīṭ, Baṣāʾir, ʿUmdat al-Ḥuffāẓ) whose full entry it shows. On wide screens the card sits in a right-hand column.
- **Two teams:** a class race on the honeycomb. Team A crosses right to left and Team B top to bottom, so the routes cross; each cell shows its hidden word's first letter.
- **Profiles:** progress and honey belong to a profile on the device, so a teacher can test a class and clear it without losing their own progress.
- **Honey jar:** points from practice and the honeycomb.

Progress stays on the learner's device, per profile. The app works offline after the first visit.

## Run it locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Data

- `sources/` – Arabic text, word parts, base words and roots (Quranic Arabic Corpus; see `sources/README.md`).
- `glosses/` – word and āyah meanings, one file per sūrah (format in `glosses/README.md`).
- `data/` – generated JSON the app loads, including `data/index/` for the word search. Rebuild after changing sources or glosses:

Dictionary entries (`data/dict/ROOT.json`) and the root summaries (`data/core.json`) are built from entries fetched from tafsir.app with `tools/build_dict.py` and `tools/build_core.py` (word shapes for progress: `tools/build_shapes.py`).

```sh
python3 tools/build_data.py
```

Word meanings are not in yet. Import them where the network allows `api.quran.com`, check the license, then rebuild:

```sh
python3 tools/import_meanings.py
python3 tools/build_data.py
```

## Publish

GitHub Pages serves the app straight from this repository: Settings → Pages → Source "Deploy from a branch" → `main` / `(root)`.
