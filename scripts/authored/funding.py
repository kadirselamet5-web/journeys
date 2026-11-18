# -*- coding: utf-8 -*-
"""Funding flow: every sum of money, or promise of one, that a provided text states.

Rule (shown verbatim in the interface): A funding edge exists only where a provided text states a sum
or a promise of one; amounts are as written; no total is computed.

Rows: dict(source, target, amount_as_written, status, date, doc, quote, note)
  source / target  person ids (p_*) or the non-person nodes below
  amount_as_written  the figure exactly as the text writes it ('$750.', 'one-half', 'not to exceed $2,000')
  status  promised | paid | acknowledged | requested | budgeted | ceiling | offered
          (promised: a pledge or an intention to pay; paid: a cheque sent or a sum wired; acknowledged: receipt
           recorded by the Museum; requested: the Museum asks for a stated sum; budgeted: an estimate or a
           salary rate; ceiling: an upper limit set; offered: a sum named in an offer of service or sale)
  date  the document's date (ISO or YYYY-MM; None for undated items)
  doc   document id; quote is verified verbatim against the transcription at build time
Edges of kind 'pi' carry the PI's own assertion from the Cast of Characters against the expedition nodes.
Nothing here is summed: the same cheque acknowledged in two letters is two attestations, not two cheques."""

FUNDING_NODES = [
 dict(id="x_amnh_fund", label="AMNH — Treasurer / Department of Vertebrate Palaeontology fund", type="fund", layer=1,
      note="The Museum's side of every transaction: the Assistant Treasurer's acknowledgments, the Director's instructions and commissions, the Treasurer named in 1909."),
 dict(id="x_exp_1907", label="Expedition 1907", type="expedition", layer=2, year=1907),
 dict(id="x_exp_1908", label="Expedition 1908", type="expedition", layer=2, year=1908),
 dict(id="x_exp_1914", label="Proposed trip, 1914 (Coffee Creek)", type="expedition", layer=2, year=1914,
      note="A trip discussed in August 1914; the file does not record it being made."),
]

FUNDING_EDGES = [
 # ---------------------------------------------------------------- 1907
 dict(source="p_pyne_percy", target="x_exp_1907", amount_as_written="$500.00", status="promised", date="1907-06-28", doc="d_19070628_bumpus_jesup",
      quote="Mr. Pyne contributed $500.00", note="Bumpus's report to Jesup; the cheque Pyne sent on 15 July was for $750.00."),
 dict(source="p_morgan", target="x_exp_1907", amount_as_written="one-half (of $1,500.00)", status="promised", date="1907-06-28", doc="d_19070628_bumpus_jesup",
      quote="Mr. Morgan stated that he thought it would be better to raise $1,500.00 and would give one-half if Mr. Pyne would raise his $500.00 to $750.00", note="Conditional on Pyne raising his subscription."),
 dict(source="x_amnh_fund", target="p_quackenbush", amount_as_written="$75.00 per month", status="budgeted", date="1907-06-29", doc="d_19070629_bumpus_quackenbush_instructions",
      quote="Your salary will be adjusted at the rate of $75.00 per month", note="Salary rate in the instructions of 29 June 1907."),
 dict(source="x_amnh_fund", target="x_exp_1907", amount_as_written="$1,500.00", status="ceiling", date="1907-06-29", doc="d_19070629_bumpus_quackenbush_instructions",
      quote="The amount of money at present available for your expedition is $1,500.00, including your salary", note="'this amount must not be exceeded except by special permission'."),
 dict(source="p_pyne_percy", target="x_amnh_fund", amount_as_written="$750.00", status="paid", date="1907-07-15", doc="d_19070715_pyne_osborn",
      quote="Sending check for $750.00 “although I did not wish to subscribe over $500.00”", note="PI summary with Pyne's own words quoted."),
 dict(source="p_pyne_percy", target="x_amnh_fund", amount_as_written="$750", status="acknowledged", date="1907-07-18", doc="d_19070718_assttreas_pyne",
      quote="Acknowledging check for $750", note="Assistant Treasurer's copy (PI summary)."),
 dict(source="p_morgan", target="x_amnh_fund", amount_as_written="$750", status="acknowledged", date="1907-07-24", doc="d_19070724_assttreas_osborn",
      quote="Acknowledging check for $750 from JP Morgan Jr", note="Reported to Osborn, through whom the cheque came."),
 dict(source="p_sturgis", target="x_amnh_fund", amount_as_written="$250", status="acknowledged", date="1907-07-24", doc="d_19070724_assttreas_osborn",
      quote="$250 from F.K. Sturgis, “a contribution toward the field exploration fund of your Department.”", note="To the Department's field exploration fund; the file does not say it was for the mammoth."),
 dict(source="p_morgan", target="x_amnh_fund", amount_as_written="$750.00", status="acknowledged", date="1907-07-24", doc="d_19070724_assttreas_morgan",
      quote="I beg to acknowledge the receipt, through Professor Osborn, of your generous contribution of $750.00 toward the expenses of the Alaskan Mammoth Expedition.", note="Acknowledgment addressed to Morgan; the same cheque as reported to Osborn the same day."),
 dict(source="p_morgan", target="x_amnh_fund", amount_as_written="$750.", status="acknowledged", date="1907-07", doc="d_190707_unnamed_osborn_excerpt_631",
      quote="I beg to acknowledge the receipt from you of a check for $750., being the contribution of Mr. J. P. Morgan, Jr., for the Alaskan Mammoth Expedition.", note="Excerpt (#631) addressed to Osborn; the same cheque, a third attestation."),
 dict(source="x_amnh_fund", target="p_quackenbush", amount_as_written="one hundred and fifty", status="paid", date="1907-10-28", doc="d_19071028_bumpus_quackenbush",
      quote="Have wired one hundred and fifty. Do you need more?", note="Wired to Quackenbush at the Ranier Grande Hotel, Seattle."),
 # ---------------------------------------------------------------- 1908
 dict(source="p_quackenbush", target="x_exp_1908", amount_as_written="$1,500", status="budgeted", date="1908-02", doc="d_190802_memorandum_1908_expedition",
      quote="they thought $1,500 would be sufficient to meet the expenses of the expedition", note="Grant and Quackenbush, calling at the Museum in February 1908; the unsigned letter of 25 February 1908 repeats the estimate as 'a fund of at least $1,500'."),
 dict(source="x_amnh_fund", target="x_exp_1908", amount_as_written="$1,500", status="promised", date="1908-02", doc="d_190802_memorandum_1908_expedition",
      quote="I was authorized to give encouragement that $1,500 would be provided for this expedition", note="Bumpus, on Osborn's authority; 'to be raised, if possible, by interesting some who had not contributed in other ways'."),
 dict(source="p_quackenbush", target="x_exp_1908", amount_as_written="$81.50", status="budgeted", date="1908-03-27", doc="d_19080327_quackenbush_bumpus_plan",
      quote="Ticket N.Y.—Seattle $81.50", note="First line of Quackenbush's estimate of 27 March 1908."),
 dict(source="p_quackenbush", target="x_exp_1908", amount_as_written="$100 per month – 3 months – 300.", status="budgeted", date="1908-03-27", doc="d_19080327_quackenbush_bumpus_plan",
      quote="Salary @ $100 per month – 3 months –", note="Salary line of the estimate; the tabulated figure is 300."),
 dict(source="p_quackenbush", target="x_exp_1908", amount_as_written="add $200 less $30", status="budgeted", date="1908-03-27", doc="d_19080327_quackenbush_bumpus_plan",
      quote="In case of crossing Seward Peninsula add $200 less $30", note="The overland alternative, costed in the estimate."),
 dict(source="x_amnh_fund", target="x_exp_1908", amount_as_written="a sum not to exceed $2,000", status="ceiling", date="1908-04-17", doc="d_19080417_bumpus_quackenbush",
      quote="a sum not to exceed $2,000 for the Alaska expedition", note="Appropriated by the Executive Committee (PI summary of Bumpus's letter)."),
 dict(source="x_amnh_fund", target="p_quackenbush", amount_as_written="$2,000.", status="ceiling", date="1908-04-28", doc="d_19080428_bumpus_quackenbush_commission",
      quote="you will be permitted to draw upon the credit of the Museum to the extent of $2,000.", note="The 1908 commission; the sum includes salary."),
 dict(source="x_amnh_fund", target="p_quackenbush", amount_as_written="$100. per month", status="budgeted", date="1908-04-28", doc="d_19080428_bumpus_quackenbush_commission",
      quote="your salary while you are in the field, at $100. per month", note="Salary rate in the 1908 commission."),
 dict(source="p_quinn", target="x_amnh_fund", amount_as_written="not less than $75.00", status="offered", date="1908-10-01", doc="d_19081001_quackenbush_bumpus_report",
      quote="with an order to sell the canoe—if possible—for not less than $75.00 which he is to forward to the Museum", note="The canoe left with Quinn at Keewalik; whether it was sold is not in the file."),
 # ---------------------------------------------------------------- 1909 settlement
 dict(source="p_morgan", target="x_exp_1908", amount_as_written="half the cost", status="promised", date=None, doc="d_nd_osborn_sherwood",
      quote="JP Morgan Jr wants to pay half the cost of LSQ’s expedition provided Percy Pyne pays the other half.", note="Undated note from Osborn to Sherwood, filed with the January 1909 letters (PI summary)."),
 dict(source="x_amnh_fund", target="x_exp_1908", amount_as_written="$1,712.27", status="paid", date="1909-01-15", doc="d_19090115_sherwood_pyne",
      quote="Total expense 1908 was $1,712.27.", note="The Museum's statement of the 1908 cost (PI summary)."),
 dict(source="p_morgan", target="x_amnh_fund", amount_as_written="$856.14", status="requested", date="1909-01-21", doc="d_19090121_sherwood_morgan",
      quote="would it be convenient to send a check “at an early date” for share, $856.14, payable to Mr. Charles Lanier, Treasurer.", note="The only statement of a half in figures; see finding f_1909_halves."),
 dict(source="p_morgan", target="x_amnh_fund", amount_as_written="one-half of the cost", status="paid", date="1909-01-22", doc="d_19090122_morgan_sherwood",
      quote="it gives me much pleasure to bear one-half of the cost of the Expedition to Alaska in search of mammoth remains", note="Cheque enclosed; no figure in the letter as summarised."),
 # ---------------------------------------------------------------- 1914
 dict(source="p_quackenbush", target="x_exp_1914", amount_as_written="$100 a month and expenses", status="offered", date="1914-08-02", doc="d_19140802_quackenbush_grant",
      quote="If you wish, I will go for $100 a month and expenses, as before.", note="Quackenbush to Grant on the Coffee Creek hair."),
 dict(source="x_amnh_fund", target="x_exp_1914", amount_as_written="not less … than $700", status="budgeted", date="1914-08-12", doc="d_19140812_lucas_grant",
      quote="not less, including Mr. Quackenbush’s salary, than $700", note="Lucas's estimate; 'I am blest if I know wher that $700 is to come from'."),
]

# The PI's own assertion (Cast of Characters), kept as kind 'pi' against the expeditions, not against Quackenbush.
FUNDING_PI_EDGES = [
 dict(source="p_morgan", target="x_exp_1907", amount_as_written="half", status="paid", kind="pi", date=None, doc="cast", quote="Paid for half of both 1907 and 1908 expeditions.", note="PI, Cast of Characters, under J.P. Morgan Jr."),
 dict(source="p_morgan", target="x_exp_1908", amount_as_written="half", status="paid", kind="pi", date=None, doc="cast", quote="Paid for half of both 1907 and 1908 expeditions.", note="PI, Cast of Characters, under J.P. Morgan Jr."),
 dict(source="p_pyne_percy", target="x_exp_1907", amount_as_written="half", status="paid", kind="pi", date=None, doc="cast", quote="Paid for half of both 1907 and 1908 expeditions.", note="PI, Cast of Characters, under Percy Pyne."),
 dict(source="p_pyne_percy", target="x_exp_1908", amount_as_written="half", status="paid", kind="pi", date=None, doc="cast", quote="Paid for half of both 1907 and 1908 expeditions.", note="PI, Cast of Characters, under Percy Pyne."),
]

RULE = "A funding edge exists only where a provided text states a sum or a promise of one; amounts are as written; no total is computed."
CAVEATS = [
 "Sturgis's $250 is 'a contribution toward the field exploration fund of your Department'; the file does not say it was for the mammoth.",
 "The 1909 halves ($856.14 each) and the stated total ($1,712.27) differ by one cent; registered as a discrepancy.",
 "The Tale's 'just over $1,600' and present-value figures are the PI's, not attested sums.",
 "Pyne's January 1909 cheque ('Pls find check.') and the Trustees' thanks of 14 November 1907 name no sum and are not drawn.",
]
