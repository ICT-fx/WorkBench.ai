You are given an excerpt from a company's annual report — text and a table — and one
question. Answer from this excerpt only, with a JSON object and nothing around it.

{{question}}

<!-- forme: nombre -->
## Answer format

`{"answer": <number>}`

A plain decimal number: no currency symbol, no thousands separator, no unit. A
percentage of 12.5% is written `12.5`. Give an amount in the unit the excerpt uses.
