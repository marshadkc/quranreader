# Word meanings

One file per sūrah, `NNN.tsv`, tab-separated with three columns:

| Column 1 | Column 2 | Column 3 |
|---|---|---|
| āyah number, e.g. `5` | English meaning of each word, separated by ` ; ` | Urdu meaning of each word, separated by ` ; ` |
| `v5` for the āyah's full meaning | English | Urdu |

Lines starting with `#` are comments. Words are listed in reading order (right to left in the Arabic),
and each āyah must have exactly as many meanings as it has words; `tools/build_data.py` checks this.
`python3 tools/build_data.py --list 112` prints a sūrah's words to help.

Meanings are imported with `tools/import_meanings.py` from an open source once its license is confirmed.
