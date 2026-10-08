# Word meanings

One file per sūrah, `NNN.tsv`, tab-separated with three columns:

| Column 1 | Column 2 | Column 3 |
|---|---|---|
| āyah number, e.g. `5` | English meaning of each word, separated by ` ; ` | Urdu meaning of each word, separated by ` ; ` |
| `v5` for the āyah's full meaning | English | Urdu |

Lines starting with `#` are comments. Words are listed in reading order (right to left in the Arabic),
and each āyah must have exactly as many meanings as it has words; `tools/build_data.py` checks this.
`python3 tools/build_data.py --list 112` prints a sūrah's words to help.

All 114 sūrahs have English and Urdu word meanings, imported from Quran.com's word-by-word translations
with `tools/import_meanings.py` (Urdu by Dr. Farhat Hashmi, Al-Huda International; Quran data provided by Quran Foundation).
Quran Foundation's developer terms do not allow storing their content as files; the project owner chose to bundle them
anyway for offline use and handles any objection. If they must be removed, delete these files and rebuild: the app then
fetches the meanings live from Quran.com again.

`tools/import_meanings.py --force` re-imports them; it checks every āyah's word count against ours.
