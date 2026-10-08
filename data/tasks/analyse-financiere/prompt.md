You are given one or two pages of a company's financial report, as images, and one
question. Answer from these pages only, with a JSON object and nothing around it.

Question: {{question}}

<!-- forme: nombre -->
## Answer format

`{"answer": <number>}`

A plain decimal number: no currency symbol, no thousands separator, no unit. Use the
unit the question asks for; a percentage of 12.5% is written `12.5`.

<!-- forme: verdict -->
## Answer format

`{"answer": "yes"}`, `{"answer": "no"}` or `{"answer": "not_applicable"}`

Use `"not_applicable"` only when the question itself invites you to say the metric is
not relevant for this company, and it is not.

<!-- forme: libelle -->
## Answer format

`{"answer": "<name>"}`

The short name of the item, as printed on the page. If the pages show there is none,
answer `{"answer": null}`.
