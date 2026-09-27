You are given the pages of a broadcast advertising invoice, as images.
Extract the requested information and answer with a JSON object only.

## The most important rule

If a piece of information **does not appear** on the document, answer `null` for
that field. Never guess, never infer, never fill in what looks usual. A value you
invent is treated as a serious error — worse than admitting you did not find it.

## Fields

- `contract_num` — the contract or order number identifying this buy, exactly as
  printed. String.
- `advertiser` — the advertiser being billed, that is the client who bought the
  advertising, not the TV station and not the media agency. String.
- `gross_amount` — the total gross amount invoiced, for the whole document.
  This is usually a grand total, and it is often on a later page than the first.
  Number.
- `flight_from` — the first day of the flight, that is the advertising period
  covered by this invoice. Format `YYYY-MM-DD`. String.
- `flight_to` — the last day of that flight. Format `YYYY-MM-DD`. String.
- `vat_number` — the VAT registration number of the issuing company, if the
  document carries one. String.

## Value formats

- Dates: `YYYY-MM-DD`. A date printed `02/03/20` on a US document means
  3 February 2020, so it becomes `2020-02-03`.
- Amounts: a plain decimal number, **no currency symbol and no thousands
  separator**. `$1,880.00` becomes `1880.00`.

## Output

A JSON object with exactly these six keys, and nothing around it.
