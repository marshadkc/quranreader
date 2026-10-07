# Word meanings

One file per sūrah, `NNN.tsv`, tab-separated with three columns:

| Column 1 | Column 2 | Column 3 |
|---|---|---|
| āyah number, e.g. `5` | English meaning of each word, separated by ` ; ` | Urdu meaning of each word, separated by ` ; ` |
| `v5` for the āyah's full meaning | English | Urdu |

Lines starting with `#` are comments. Words are listed in reading order (right to left in the Arabic),
and each āyah must have exactly as many meanings as it has words; `tools/build_data.py` checks this.
`python3 tools/build_data.py --list 112` prints a sūrah's words to help.

No meanings are bundled yet. The app currently shows English word meanings live from the Quran.com API
(word-by-word English, credited "Quran data provided by Quran Foundation"), keeping a copy on the device for at most 7 days,
because Quran Foundation's developer terms do not allow storing their content longer or sharing it as a dataset.
That is also why `glosses/` stays empty: Quran.com data must not be committed here without written permission.

Urdu word meanings are left out for now. The Urdu word-by-word set on Quran.com and QUL is reported to be Al-Huda's
(Dr. Farhat Hashmi), and this app does not use Al-Huda content.

`tools/import_meanings.py` turns the Quran.com word-by-word data into these files. Use it only once a source's owner has
confirmed in writing that the meanings may be bundled with the app; it checks every āyah's word count against ours.
