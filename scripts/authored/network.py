# -*- coding: utf-8 -*-
"""Network evidence rules and hand-authored ties.

Three evidence kinds (nominalist: a tie exists only where a provided text asserts it):
  'correspondence'  — A wrote to B. Generated automatically in build_data.py from documents.json
                      (one directed edge per archival item; copies, drafts, telegrams, excerpts and
                      enclosures all count as attestations of writing; weight = number of items).
  'stated'          — a relation asserted inside a document by its writer (e.g. 'my partner').
  'pi'              — a relation asserted in the PI's own writing (Tale §3, Cast of Characters,
                      timeline summaries). These are the PI's interpretations, kept separate.
Each hand-authored tie: source, target, kind, label, directed, evidence=[(source_id, quote)],
optional evidence_kind='letterhead' (the quotation is a printed letterhead officer list, not a
sentence written by the signer; such ties are tagged in the interface).
source_id is a document id, 'tale', 'cast', or 'pi_timeline'. Quotes are checked at build time
against the provided texts (normalised quotes/dashes/whitespace). The build dates each tie by the
first document among its evidence refs (the date is the document's, not the relationship's)."""

TIES = [
 # ---------------------------------------------------------------- stated in documents
 dict(source="p_startsman", target="p_graham", kind="stated", label="partner", directed=False,
      evidence=[("d_19061230_startsman_graham_reed","I immediately consulted my partner C.W. Graham [sic]")]),
 dict(source="p_old_indian", target="p_graham", kind="stated", label="guided to the animal (1898, 1899)", directed=True,
      evidence=[("d_19061230_startsman_graham_reed","in 1898 and 1899 he took my partner E.W. Graham to see the animal")]),
 dict(source="p_chilberg", target="p_startsman", kind="stated", label="conference respecting a mastodon (1906; place not stated)", directed=True,
      evidence=[("d_19061018_reed_startsman","has advised me of his conference with you respecting a mastodon")]),
 dict(source="p_reed", target="p_chilberg", kind="stated", label="discussed 'the uses to which the mastodon could be put' with Chilberg", directed=True,
      evidence=[("d_19061018_reed_startsman","President Chilberg and myself today briefly discussed the uses to which the mastodon could be put")]),
 dict(source="p_meany", target="p_chilberg", kind="stated", label="first information came through Chilberg", directed=True,
      evidence=[("d_19070623_meany_bumpus","The first information of the mammoth came to us through him")]),
 dict(source="p_meany", target="p_harlan_smith", kind="stated", label="names as reference", directed=True,
      evidence=[("d_19070318_meany_bumpus","You may learn who I am from Mr. Harlan J. Smith of your staff at the Museum.")]),
 dict(source="p_sherwood", target="p_matthew", kind="stated", label="asked Matthew to report", directed=True,
      evidence=[("d_19070325_matthew_bumpus","Mr Sherwood has asked me to report on the enclosed correspondence.")]),
 dict(source="p_matthew", target="p_quackenbush", kind="stated", label="recommends; 'a man in whom we could place confidence'", directed=True,
      evidence=[("d_19070325_matthew_bumpus","he is a man in whom we could place confidence"),("d_19070417_matthew_osborn","I have given him Maddren's report to the Smithsonian")]),
 dict(source="p_matthew", target="p_brown", kind="stated", label="alternative candidate", directed=True,
      evidence=[("d_19070325_matthew_bumpus","Brown or Granger if they could be spared"),("d_19070417_matthew_osborn","In case Quackenbush cannot go, I should recommend Barnum Brown.")]),
 dict(source="p_matthew", target="p_granger", kind="stated", label="alternative candidate", directed=True,
      evidence=[("d_19070325_matthew_bumpus","Brown or Granger if they could be spared")]),
 dict(source="p_osborn", target="p_quackenbush", kind="stated", label="vouches: 'a perfectly honorable man'", directed=True,
      evidence=[("d_19070416_osborn_bumpus","Mr. Quackenbush whom we have in mind is an experienced traveler and a perfectly honorable man")]),
 dict(source="p_anderson", target="p_osborn", kind="stated", label="claims 'old intimate friend'", directed=True,
      evidence=[("d_19070427_bumpus_osborn","Says you are old intimate friend.")]),
 dict(source="p_anderson", target="p_stone", kind="stated", label="asks Stone to investigate in his place", directed=True,
      evidence=[("d_19070518_anderson_stone","Could you not make some investigations as to the reliability of the men")]),
 dict(source="p_grant", target="p_stone", kind="stated", label="co-officers, Taylor Creek Ditch Company (President / VP & GM)", directed=False, evidence_kind="letterhead",
      evidence=[("d_19070620_stone_bumpus","Madison Grant, President"),("d_19070620_stone_bumpus","Andrew J. Stone, Vice-President and General Manager")]),
 dict(source="p_allen", target="p_grant", kind="stated", label="co-officer (Treasurer), Taylor Creek Ditch Company", directed=False, evidence_kind="letterhead", evidence=[("d_19070620_stone_bumpus","Benjamin Leach Allen, Treasurer, 66 Broadway")]),
 # Robert T. Varnum, Secretary, appears on the same letterhead with the name struck through: no tie is asserted (see p_varnum.identity_note and finding f_varnum_struck).
 dict(source="p_grant", target="p_pyne_percy", kind="stated", label="Pyne 'largely interested' in Grant's project (Osborn's report of Grant)", directed=False,
      evidence=[("d_19070620_osborn_bumpus","Grant thinks that Percy Pyne—who is largely interested in the [??] project—will probably put up the money for Q. to go."),("d_19070628_bumpus_jesup","Mr. Pyne (who, I believe, is financially interested in the mining enterprise with Mr. Grant)")]),
 dict(source="p_grant", target="p_morgan", kind="stated", label="asked Morgan to assist", directed=True,
      evidence=[("d_19070628_bumpus_jesup","Mr. Grant asked Mr. J. P. Morgan, Jr., if he cared to assist"),("d_19070622_grant_bumpus","I believe that Prof. Osborn can arrange about the mammoth exploration fund with Jack Morgan, and have telegraphed him to that effect.")]),
 dict(source="p_grant", target="p_quackenbush", kind="stated", label="to direct LSQ in the field ('free hand'); travelling companion", directed=True,
      evidence=[("d_19070701_bumpus_grant","a clause that will give you practically a free hand in case you think it wise for Mr. Quackenbush to act otherwise than directed"),("d_19070703_grant_bumpus","I am sure he will be a very attractive companion and I am delighted to have him with me.")]),
 dict(source="p_osborn", target="p_pyne_mt", kind="stated", label="familiar address ('My dear Momo'); brother of Percy", directed=True,
      evidence=[("d_19080228_osborn_mtpyne","I take pleasure in sending to your brother Percy through you an album")]),
 dict(source="p_pyne_mt", target="p_pyne_percy", kind="stated", label="brothers", directed=False, evidence=[("d_19080228_osborn_mtpyne","your brother Percy")]),
 dict(source="p_osborn", target="p_morgan", kind="stated", label="familiar address ('My dear Jack' / 'My dear Fairfield')", directed=False,
      evidence=[("d_19080228_osborn_morgan","My dear Jack:"),("d_19080302_morgan_osborn","My dear Fairfield,")]),
 dict(source="p_quackenbush", target="p_hoffman", kind="stated", label="engaged as cook and assistant; hired his dory", directed=True,
      evidence=[("d_19081001_quackenbush_bumpus_report","At Candle I engaged a man to act as cook and assistant and also hired his fishing dory"),("d_19080327_quackenbush_bumpus_plan","he has written to me and asked to go again")]),
 dict(source="p_quackenbush", target="p_quinn", kind="stated", label="left outfit in Quinn's charge", directed=True,
      evidence=[("d_19081001_quackenbush_bumpus_report","left in charge of Mr. Ferdinand Quinn (P.O. address Candle, Alaska)")]),
 dict(source="p_quackenbush", target="p_maddren", kind="stated", label="uses Maddren's map/report", directed=True,
      evidence=[("d_19080327_quackenbush_bumpus_plan","A. G. Maddren (\"Smithsonian Exploration in search of mammoth\") marks on his map")]),
 dict(source="p_quackenbush", target="p_beechey", kind="stated", label="checks Beechey's 1826 report", directed=True,
      evidence=[("d_19081001_quackenbush_bumpus_report","\"mud\" banks were reported by Beechey in 1826")]),
 dict(source="p_osborn", target="p_gilmore", kind="stated", label="rival collector to be beaten", directed=True,
      evidence=[("d_19070620_osborn_bumpus","get in ahead of Gilmore—who is going up from the U.S. National Museum")]),
 dict(source="p_lucas", target="p_gilmore", kind="stated", label="cites Gilmore's reconnaissance", directed=True,
      evidence=[("d_19140806_lucas_grant","Gilmore of Washington made a thorough reconnaissance for the National Museum")]),
 dict(source="p_lucas", target="p_matthew", kind="stated", label="consulted Matthew (1914)", directed=True,
      evidence=[("d_19140806_lucas_grant","I have gone over the matter pretty carefully with Doctor Matthew")]),
 dict(source="p_osborn", target="p_lucas", kind="stated", label="forwarded Grant's letter to Lucas (1914)", directed=True,
      evidence=[("d_19140806_lucas_grant","President Osborn has forwarded to me your letter enclosing that of Mr. Quackenbush."),("d_19140804_grant_osborn","To Director Lucas")]),
 dict(source="p_grant", target="p_mathews_jf", kind="stated", label="Mathews writes at Grant's request; employee of Grant's company", directed=True,
      evidence=[("d_19140810_grant_lucas","Mathews who writes the letter to Quackenbush is in the employ of a company which I am heavily interested in, and he writes this at my request.")]),
 dict(source="p_mathews_jf", target="p_quackenbush", kind="stated", label="wrote to LSQ from Alaska with hair sample (1914)", directed=True,
      evidence=[("d_19140807_lucas_quackenbush","a communication from Mr. J. F. Matthews addressed to you")]),
 dict(source="p_grant", target="p_quackenbush", kind="stated", label="'I do not believe that you can get a better man' (1914)", directed=True,
      evidence=[("d_19140810_grant_lucas","I do not believe that you can get a better man that [sic] Quackenbush for this purpose.")]),
 dict(source="p_bumpus", target="p_quackenbush", kind="stated", label="recommends to Bureau of Fisheries (1910)", directed=True,
      evidence=[("d_19100518_bumpus_hughsmith","He is a nice fellow, and we can give him an excellent recommendation.")]),
 dict(source="p_hugh_smith", target="p_andrews", kind="stated", label="inquires about Andrews for the fur-seal islands post", directed=True,
      evidence=[("d_19100509_hughsmith_bumpus","Would \"Mr. Roy C. Andrews fill the bill\"")]),
 dict(source="p_lucas", target="p_peale", kind="stated", label="cites Peale's Newburgh mastodon", directed=True, evidence=[("d_19140812_lucas_grant","Peale found hair of the mastodon when he dug it up back of Newburgh")]),
 dict(source="p_lucas", target="p_nelson", kind="stated", label="cites 'the observations of Nelson'", directed=True, evidence=[("d_19140812_lucas_grant","the observations of Nelson")]),
 dict(source="p_osborn", target="p_ripley", kind="stated", label="names Miss Ripley as intermediary to Quackenbush", directed=True, evidence=[("d_19070620_osborn_bumpus","Through Dr. Matthews (or Miss Ripley) will you kindly communicate immediately with Mr. Quackenbush")]),
 dict(source="p_sturgis", target="p_osborn", kind="stated", label="$250 to the Department's field exploration fund", directed=True, evidence=[("d_19070724_assttreas_osborn","$250 from F.K. Sturgis")]),
 dict(source="p_quackenbush", target="p_woods_ah", kind="stated", label="c/o address, Tarratine, Maine", directed=True, evidence=[("d_19140802_quackenbush_grant","writing c/o A.H. Woods, Tarratine, Maine")]),
 dict(source="p_osborn", target="p_sherwood", kind="stated", label="instructs on collecting Morgan's and Pyne's shares", directed=True, evidence=[("d_nd_osborn_sherwood","Kindly take this up at once.")]),
 # ---------------------------------------------------------------- PI's writing (Cast of Characters, Tale, timelines)
 dict(source="p_anderson", target="p_quackenbush", kind="pi", label="'usurps LSQ's role'", directed=True, evidence=[("cast","usurps LSQ’s role by offering to go examine claim for free")]),
 dict(source="p_anderson", target="p_osborn", kind="pi", label="'old intimate friend' of HFO", directed=False, evidence=[("cast","An “old intimate friend” of HFO")]),
 dict(source="p_grant", target="p_quackenbush", kind="pi", label="goes to Alaska with LSQ 1907, assists up to Nome", directed=True, evidence=[("cast","Goes to Alaska with LSQ 1907, assists up to Nome."),("tale","Quackenbush left for Alaska in the company of Madison Grant")]),
 dict(source="p_grant", target="p_stone", kind="pi", label="Stone is Grant's VP/Gen Manager; 'colleague'", directed=False, evidence=[("cast","whose VP/Gen Manager is Andrew J. Stone"),("cast","Colleague of Madison Grant")]),
 dict(source="p_matthew", target="p_quackenbush", kind="pi", label="recommends LSQ for job", directed=True, evidence=[("cast","Reports on Startsman letters, recommends LSQ for job.")]),
 dict(source="p_meany", target="p_bumpus", kind="pi", label="go-between for A-Y-P and AMNH", directed=True, evidence=[("cast","go-between for A-Y-P people and AMNH")]),
 # The PI's 'Paid for half of both 1907 and 1908 expeditions.' (Morgan, Pyne) is a tie to the expeditions, not to Quackenbush; it is carried as kind 'pi' in funding.py against the expedition nodes.
 dict(source="p_startsman", target="p_graham", kind="pi", label="partners; finders of purported mammoth", directed=False, evidence=[("cast","Finder of purported mammoth, partner of E.W. Graham")]),
 dict(source="p_stone", target="p_quackenbush", kind="pi", label="asked, but refuses, to deal with the mammoth 1907", directed=True, evidence=[("cast","asked, but refuses, to deal with the mammoth 1907")]),
 dict(source="p_osborn", target="p_morgan", kind="pi", label="'went hat in hand' for funds", directed=True, evidence=[("tale","went hat in hand to J.P. Morgan, Jr., and another wealthy financier Percy Pyne")]),
 dict(source="p_osborn", target="p_pyne_percy", kind="pi", label="'went hat in hand' for funds", directed=True, evidence=[("tale","went hat in hand to J.P. Morgan, Jr., and another wealthy financier Percy Pyne")]),
 dict(source="p_pyne_mt", target="p_osborn", kind="pi", label="'intimate friend of Osborn'", directed=False, evidence=[("tale","whose brother was an intimate friend of Osborn")]),
 dict(source="p_meany", target="p_bumpus", kind="pi", label="brought the report to the Director (March 1907)", directed=True, evidence=[("tale","brought to the Director, H.C. Bumpus, in March 1907, by Edmond S. Meany")]),
 dict(source="p_quackenbush", target="p_hoffman", kind="pi", label="concealed the find from his local assistant", directed=True, evidence=[("tale","concealing it even from his local assistant, Jim Hoffman")]),
 dict(source="p_grant", target="p_bumpus", kind="pi", label="petitioned Bumpus with LSQ for a return visit", directed=True, evidence=[("tale","with the support of Madison Grant, then Sec’y to the NY Zoological Society and notorious eugenicist, petitioned Bumpus for a return visit")]),
 dict(source="p_osborn", target="p_morgan", kind="pi", label="working on Morgan (Grant to Bumpus, 22 June 1907, as summarised by the PI)", directed=True, evidence=[("pi_timeline","Grant tells Bumpus HFO also working on Morgan.")]),
 dict(source="p_grant", target="p_quackenbush", kind="pi", label="deems LSQ's 1908 report 'an extremely barren narrative'", directed=True, evidence=[("pi_timeline","Grant deems it “an extremely barren narrative”")]),
 dict(source="p_quackenbush", target="p_maddren", kind="pi", label="given Maddren's SI report", directed=True, evidence=[("pi_timeline","gives LSQ Maddren’s SI report")]),
]

# Person–institution affiliations are generated from PEOPLE[*].institutions in people.py.
