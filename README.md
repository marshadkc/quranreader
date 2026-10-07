# Quran Word Reader

An installable web app that teaches non-Arabic speakers to understand the Quran directly while reading.
It covers Al-Fātiḥah and Juz ʿAmma (Sūrahs 78–114).

- **Reader:** every word sits in its own box with its English and Urdu meaning under it. Prefixes and endings are coloured, and tapping a word shows its parts, base word and root. Each meaning fades as you learn the word, until you read plain Arabic.
- **Practice:** a quick quiz per sūrah. Words you know least, and words that appear most often, come first.
- **Word parts:** the small attachments (وَ، فَ، بِ، لِ، ال، ـهُم …) with their meanings and how often they appear.
- **Ayah Honeycomb:** the review game for the whole juz. An āyah's words zig-zag from the right edge of the honeycomb to the left; reveal each word in reading order and choose its meaning. Right answers fill with honey.
- **Honey jar:** points from practice and the honeycomb.

Progress stays on the learner's device. The app works offline after the first visit.

## Run it locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Data

- `sources/` – Arabic text, word parts, base words and roots (Quranic Arabic Corpus; see `sources/README.md`).
- `glosses/` – word and āyah meanings, one file per sūrah (format in `glosses/README.md`).
- `data/` – generated JSON the app loads. Rebuild after changing sources or glosses:

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
