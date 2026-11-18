# -*- coding: utf-8 -*-
"""Historical gazetteer for the Quackenbush journeys.
Each place is an attested NAME first and a coordinate second.

tier (placement hierarchy requested by the lab):
 1 published coordinates for named settlements/headlands/rivers/ports — not used: no coordinates
   occur in the provided documents, so tier 1 is empty by construction and recorded as such.
 2 authoritative gazetteer (USGS GNIS DomesticNames_AK, downloaded 2026-11-18; Canadian CGNDB;
   GeoNames); Wikidata used only as cross-check.
 3 historical map / chart — none available in this build (the 1906 Post Route Map named by LSQ was
   not provided); recorded as absent.
 4 Quackenbush's own distance/direction descriptions (river miles, 'x miles below', etc.).
 5 approximate placement with a large uncertainty radius.

precision: 'settlement' | 'feature-centroid' | 'river-mouth' | 'approximate' | 'inferred' | 'unlocated'
status chip: 'verified' (gazetteer match for the attested name), 'inferred' (identification is a model
inference from the described route), 'approximate' (placed from distances/directions), 'disputed'
(sources disagree), 'unlocated' (cannot be placed from the sources).
radius_km: uncertainty radius drawn on the map (halo). Point features from GNIS get a nominal radius
describing the feature's extent, not a positional error.
"""

GNIS_FILE = "USGS GNIS Domestic Names, Alaska (DomesticNames_AK.txt), prd-tnm.s3.amazonaws.com, retrieved 2026-11-18"

def gnis(fid, name, fclass, lat, lon, map_name=None):
    return dict(authority="USGS GNIS", id=str(fid), name=name, feature_class=fclass, lat=lat, lon=lon,
                url=f"https://edits.nationalmap.gov/apps/gaz-domestic/public/summary/{fid}", file=GNIS_FILE, map=map_name)

def wd(q, label, lat, lon):
    return dict(authority="Wikidata (cross-check only)", id=q, name=label, lat=lat, lon=lon, url=f"https://www.wikidata.org/wiki/{q}")

def geonames(gid, label, lat=None, lon=None):
    return dict(authority="GeoNames", id=str(gid), name=label, lat=lat, lon=lon, url=f"https://www.geonames.org/{gid}")

PLACES = [
 # ------------------------------------------------------------------ institutional nodes
 dict(id="pl_newyork", label="New York", attested=[("New York","B.AMNH 26 p.88 via PI; letters"),("NY","PI timeline"),("New York City","LSQ report 1 Oct 1908")],
      role="origin/terminus of both journeys; seat of the AMNH", lat=40.7128, lon=-74.0061, tier=2, precision="settlement", status="verified", radius_km=8,
      coord_source=geonames(5128581,"New York City",40.71427,-74.00597), crosscheck=[wd("Q60","New York City",40.7128,-74.0061)],
      gnis_note="GNIS 975772 (Populated Place) and 2395220 (Civil) per Wikidata; coordinates here from GeoNames/Wikidata (city-level).",
      why="LSQ's departures and returns are recorded only as 'New York'. The AMNH's own location is not given in the documents; the city centroid is used, not the museum."),
 dict(id="pl_seattle", label="Seattle", attested=[("Seattle","letters; B.AMNH 26 via PI"),("Ranier Grande Hotel, Seattle, Wash.","Bumpus to LSQ 28 Oct 1907"),("Rainer Grand Hotel","LSQ letterheads 1908")],
      role="rail/sea interchange, both journeys; seat of the A-Y-P Exposition", lat=47.6062, lon=-122.3321, tier=2, precision="settlement", status="verified", radius_km=6,
      coord_source=geonames(5809844,"Seattle",47.60621,-122.33207), crosscheck=[wd("Q5083","Seattle",47.605,-122.33)],
      gnis_note="GNIS 1512650 (Populated Place) per Wikidata.", why="Named as the port of departure for Nome (1907 'by way of Seattle'; 1908 'Umatilla' from Seattle). Hotel address not geocoded."),
 dict(id="pl_montreal", label="Montreal", attested=[("Montreal","LSQ to Bumpus 19 May 1908"),("Mtl","PI timeline")], role="1908 rail routing via the Canadian Pacific",
      lat=45.5033, lon=-73.5868, tier=2, precision="settlement", status="verified", radius_km=8,
      coord_source=dict(authority="Canadian Geographical Names Database (CGNDB)", id="Montréal (CITY, Québec)", name="Montréal", lat=None, lon=None, url="https://geogratis.gc.ca/services/geoname/en/geonames?q=Montr%C3%A9al&concise=CITY", note="CGNDB returns a polygon; point taken from GeoNames"),
      crosscheck=[geonames(6077243,"Montréal",45.50884,-73.58781), wd("Q340","Montreal",45.5033,-73.5868)],
      why="LSQ: 'I leave this evening for Seattle via Montreal and the Canadian Pacific' (19 May 1908). Only the routing is attested; no stop duration."),
 dict(id="pl_washington", label="Washington, D.C.", attested=[("Smithsonian Institution, Washington, D.C.","Bumpus to Rathbun 25 Apr 1907"),("Gilmore of Washington","Lucas 1914")],
      role="correspondence node (Smithsonian; Department of Agriculture permit; Post Office Dept; Bureau of Fisheries)", lat=38.895, lon=-77.0367, tier=2, precision="settlement", status="verified", radius_km=8,
      coord_source=geonames(4140963,"Washington",38.89511,-77.03637), crosscheck=[wd("Q61","Washington, D.C.",38.895,-77.0367)],
      why="No journey stop; shown on the map as a correspondence node only. The Department of Agriculture and Bureau of Fisheries letters do not state a city; Washington is inferred for them from the Smithsonian letter only and marked accordingly in the documents."),
 dict(id="pl_garrison", label="Garrison on Hudson", attested=[("Garrison on Hudson","Bumpus telegram [27 Apr 1907]"),("Garrison","Bumpus to HFO 21 June 1907; Osborn 3 July 1907")], role="Osborn's address when away from the Museum",
      lat=41.3839, lon=-73.9456, tier=2, precision="settlement", status="verified", radius_km=3,
      coord_source=gnis(974279,"Garrison","Populated Place",41.3839,-73.9456), crosscheck=[wd("Q5524005","Garrison (Putnam County, NY)",41.3839,-73.9456), geonames(5118289,"Garrison",41.3826,-73.9471)],
      why="Correspondence node only. Identification of 'Garrison on Hudson' with GNIS Garrison, Putnam County, NY (on the Hudson) is a gazetteer match on the attested name."),
 # ------------------------------------------------------------------ 1907 route (Yukon)
 dict(id="pl_dawson", label="Dawson", attested=[("Dawson","B.AMNH 26 p.88 via PI timeline")], role="1907: arrived 19 July; three days",
      lat=64.0608, lon=-139.4317, tier=2, precision="settlement", status="verified", radius_km=4,
      coord_source=dict(authority="Canadian Geographical Names Database (CGNDB)", id="Dawson (TOWN, Yukon, province code 60)", name="Dawson", lat=None, lon=None, url="https://geogratis.gc.ca/services/geoname/en/geonames?q=Dawson&province=60", note="CGNDB returns a polygon; point taken from GeoNames"),
      crosscheck=[geonames(6943713,"Dawson City",64.0601,-139.4332), wd("Q372324","Dawson City",64.0608,-139.4317)],
      why="The route from Seattle to Dawson is NOT described in the provided documents (only arrival on 19 July 1907). The connector Seattle→Dawson is therefore schematic with mode unknown."),
 dict(id="pl_fortgibbon", label="Fort Gibbon", attested=[("Fort Gibbon","B.AMNH 26 p.89 via PI timeline")], role="1907: LSQ continues to Fort Gibbon, 25 July; Grant to Fairbanks",
      lat=65.1714, lon=-152.0532, tier=2, precision="settlement", status="verified", radius_km=3,
      coord_source=wd("Q16981229","Fort Gibbon",65.1714,-152.0532), crosscheck=[gnis(1410629,"Tanana","Populated Place",65.1719444,-152.0788889)],
      gnis_note="No GNIS Domestic Name 'Fort Gibbon' found in the Alaska file; Wikidata Q16981229 supplies the point, which lies ~1 km from GNIS 'Tanana' (Populated Place). Used as the primary source for this one point and flagged.",
      why="Only arrival is attested. Equivalence of Fort Gibbon with the settlement of Tanana is NOT asserted by the sources; the GNIS Tanana record is given as a cross-check only."),
 dict(id="pl_palisades", label="The Palisades (Yukon)", attested=[("the Palisades","PI timeline"),("'a high cut bank' on the Yukon 35 miles below mouth of Tanana","B.AMNH 26 p.89 as summarised by PI")],
      role="1907: examined by LSQ, 25 July", lat=65.1081, lon=-153.3378, tier=2, precision="feature-centroid", status="verified", radius_km=8,
      coord_source=gnis(1410830,"The Palisades","Cliff",65.1080556,-153.3377778,"Melozitna A-1 SW"), crosscheck=[],
      distance_check="GNIS point lies c. 60 km down the Yukon from Tanana, consistent with Quackenbush's '35 miles below mouth of Tanana' (tier 4 check).",
      why="Gazetteer name matches the attested name and the described position; radius reflects the length of the cliff feature, not positional doubt."),
 dict(id="pl_stmichael", label="St Michael", attested=[("St Michaels","PI timeline (B.AMNH 26 p.89)"),("St. Michaels","Startsman and Graham 30 Dec 1906"),("St Michael","LSQ to Bumpus 26 Apr 1907")],
      role="1907: steamed to, 29 July; tug to Nome 4 Aug", lat=63.4781, lon=-162.0392, tier=2, precision="settlement", status="verified", radius_km=3,
      coord_source=gnis(1408977,"Saint Michael","Populated Place",63.4780556,-162.0391667), crosscheck=[wd("Q80160","St. Michael",63.4711,-162.0531)],
      why="Gazetteer match on the attested name (spelled 'Saint Michael' in GNIS)."),
 dict(id="pl_nome", label="Nome", attested=[("Nome","throughout")], role="both journeys: Alaskan port of entry/exit; home of Startsman and Graham",
      lat=64.5011, lon=-165.4064, tier=2, precision="settlement", status="verified", radius_km=4,
      coord_source=gnis(1407125,"Nome","Populated Place",64.5011111,-165.4063889), crosscheck=[wd("Q79996","Nome",64.5,-165.4), geonames(5870133,"Nome",64.5011,-165.4064)],
      why="Gazetteer match on the attested name."),
 dict(id="pl_solomon_river", label="Solomon River", attested=[("Solomon R., 30 mi to the east","PI timeline (B.AMNH 26 p.89)")], role="1907: short trip from Nome (dates not given; within 4–13 Aug)",
      lat=64.5503, lon=-164.4111, tier=2, precision="river-mouth", status="verified", radius_km=15,
      coord_source=gnis(1409874,"Solomon River","Stream",64.5502778,-164.4111111), crosscheck=[wd("Q131344863","Solomon River",64.5514,-164.4136)],
      distance_check="GNIS mouth lies c. 47 km (29 mi) east of Nome, matching '30 mi to the east' (tier 4 check).",
      why="GNIS stream coordinates denote the mouth. How far up the river LSQ went is not stated; the halo covers the lower river."),
 dict(id="pl_keewalik", label="Keewalik ('the spit')", attested=[("Keewalik","letters; PI timeline"),("'the spit'","B.AMNH 26 p.89 via PI"),("Kiwalik","GNIS modern spelling (not in sources)")],
      role="both journeys: 'the final outfitting point' on Kotzebue Sound", lat=66.0228, lon=-161.8419, tier=2, precision="settlement", status="verified", radius_km=3,
      coord_source=gnis(1413351,"Kiwalik","Populated Place",66.0227778,-161.8419444,"Selawik A-6 SW"), crosscheck=[wd("Q3068117","Kiwalik",66.0228,-161.8419)],
      why="Attested 'Keewalik' matched to GNIS 'Kiwalik' (Populated Place) at the eastern end of Kotzebue Sound, consistent with LSQ's description. The spelling equivalence is a model identification of an orthographic variant; no source states it."),
 dict(id="pl_candle", label="Candle", attested=[("Candle","B.AMNH 26 p.89 via PI ('a few miles up Keewalik River'); LSQ 1908")], role="1907 visited; 1908 wagon terminus, engaged Hoffman",
      lat=65.9133, lon=-161.9244, tier=2, precision="settlement", status="verified", radius_km=3,
      coord_source=gnis(1412708,"Candle","Populated Place",65.9133333,-161.9244444,"Candle D-6 NW"), crosscheck=[wd("Q2936297","Candle",65.9133,-161.924)],
      distance_check="GNIS Candle lies c. 13 km up-valley from GNIS Kiwalik, consistent with 'a few miles up Keewalik River'.", why="Gazetteer match on the attested name."),
 dict(id="pl_keewalik_river", label="Keewalik River", attested=[("Keewalik River","B.AMNH 26 p.89 via PI; LSQ report 1908 ('rowed down the Keewalik River')")], role="river between Candle and Keewalik",
      lat=65.9411, lon=-161.8778, tier=2, precision="river-mouth", status="verified", radius_km=6,
      coord_source=gnis(1413353,"Kiwalik River","Stream",65.9411111,-161.8777778,"Candle D-6 NW"), crosscheck=[], why="Route feature, not a stop."),
 dict(id="pl_kotzebue_sound", label="Kotzebue Sound", attested=[("Kotzebue Sound","B.AMNH 26 via PI; LSQ letters")], role="sea area crossed to Elephant Point", lat=66.4929, lon=-162.9581, tier=2, precision="feature-centroid", status="verified", radius_km=60,
      coord_source=gnis(1413379,"Kotzebue Sound","Sea",66.4929469,-162.9581036), crosscheck=[wd("Q943234","Kotzebue Sound",66.5461,-162.7494)], why="Context feature (label only)."),
 dict(id="pl_elephant_point", label="Elephant Point", attested=[("Elephant Point","throughout"),("the bluff at Elephant Point","Tale")], role="site of the mammoth remains (found 1907, excavated 1908)",
      lat=66.2589, lon=-161.3347, tier=2, precision="feature-centroid", status="verified", radius_km=3,
      coord_source=gnis(1412975,"Elephant Point","Cape",66.2588889,-161.3347222,"Selawik B-5 SW"), crosscheck=[gnis(1412976,"Elephant Point","Populated Place",66.2597222,-161.3461111), wd("Q5359352","Elephant Point",66.2589,-161.3347)],
      why="GNIS has both a Cape and a Populated Place of this name 0.5 km apart; the Cape (headland/bluff) is used because the sources speak of 'the bluff'. The exact excavation spot within the bluff ('an area about ten by seven feet') is not located in the sources."),
 dict(id="pl_eschscholtz_bay", label="Eschscholtz Bay", attested=[("Eschscholtz Bay","throughout"),("Eschholz [sic] Bay","Bumpus 28 Apr 1908"),("Exchscholtz Bay","LSQ report (as transcribed)"),("'big bone beach'","Osborn 20 June 1907; Bumpus instructions 1907")],
      role="bay containing Elephant Point; 'the well known fossil deposit'", lat=66.2972, lon=-161.5001, tier=2, precision="feature-centroid", status="verified", radius_km=25,
      coord_source=gnis(1412993,"Eschscholtz Bay","Sea",66.2971849,-161.5000533,"Selawik B-6 SE"), crosscheck=[wd("Q15216772","Eschscholtz Bay",66.3081,-161.3172)],
      why="Context feature. Osborn's 'big bone beach' is equated with Eschscholtz Bay by Osborn himself ('Eschscholtz Bay—\"big bone beach\"')."),
 dict(id="pl_choris_bluff", label="Cut bluff near Choris Peninsula (north shore)", attested=[("'a cut bluff on the north side near Choris Peninsula'","LSQ report 1 Oct 1908")], role="1908: fossils gathered after the excavation (date not given)",
      lat=66.2847, lon=-161.8806, tier=5, precision="approximate", status="approximate", radius_km=12,
      coord_source=gnis(1412776,"Choris Peninsula","Cape",66.2847222,-161.8805556,"Selawik B-6 SE"), crosscheck=[wd("Q5105071","Choris Peninsula",66.2847,-161.881)],
      why="The bluff is described only relative to Choris Peninsula; the GNIS point for the peninsula is used with a 12 km halo. LSQ notes the silt deposit is 'continuous with that on Eschscholtz Bay near Choris Peninsula'."),
 dict(id="pl_buckland_mouth", label="Buckland River (mouth / estuary)", attested=[("Buckland R","PI timeline"),("the Buckland River","LSQ 27 Mar 1908; report 1908"),("Bukland River","LSQ 27 Mar 1908 (as written)")], role="1907: entered 1 Sept, 15 miles; 1908: 20 July–5 Aug",
      lat=66.2433, lon=-161.0442, tier=2, precision="river-mouth", status="verified", radius_km=6,
      coord_source=gnis(1412685,"Buckland River","Stream",66.2433333,-161.0441667), crosscheck=[wd("Q2927472","Buckland River",66.2433,-161.0442)],
      why="GNIS stream coordinates denote the mouth, which is where both ascents began."),
 dict(id="pl_buckland_8mi", label="Dory anchorage, '8 miles up the river'", attested=[("'the dory was anchored 8 miles up the river and we took to the canoe'","LSQ report 1 Oct 1908 (22 July 1908)")], role="1908: 22 July",
      lat=66.17, lon=-160.98, tier=4, precision="approximate", status="approximate", radius_km=8,
      coord_source=dict(authority="Quackenbush's distance statement (river miles) projected along a schematic river axis from the GNIS mouth toward GNIS West Fork Buckland River", id=None, name=None, lat=None, lon=None, url=None),
      why="River miles are not straight-line distances and the river geometry was not traced in this build; the point is a schematic projection and the halo is deliberately generous."),
 dict(id="pl_buckland_62mi", label="Silt deposit, '62 miles up the river'", attested=[("'one such deposit at the lower end of a broad basin — 62 miles up the river — is fully one hundred feet thick'","LSQ report 1 Oct 1908")], role="1908: between 22 and 28 July",
      lat=65.78, lon=-160.55, tier=4, precision="approximate", status="approximate", radius_km=20,
      coord_source=dict(authority="Quackenbush's distance statement (river miles) projected along a schematic river axis", id=None, name=None, lat=None, lon=None, url=None),
      why="Position inferred from LSQ's river-mile estimate only. Treat as 'somewhere in the middle Buckland'."),
 dict(id="pl_buckland_86mi", label="Turning point, 'estimated at 86 miles above the mouth'", attested=[("'On July 28th I reached a point estimated at 86 miles above the mouth of the river and could go no further with the canoe'","LSQ report 1 Oct 1908"),("about 80 miles inland","Tale (PI)"),("lava overlaps sedimentary rocks 'at a point 90 miles above the mouth'","LSQ report")],
      role="1908: 28 July; furthest point", lat=65.60, lon=-160.35, tier=4, precision="approximate", status="disputed", radius_km=25,
      coord_source=dict(authority="Quackenbush's distance statement (river miles) projected along a schematic river axis", id=None, name=None, lat=None, lon=None, url=None),
      why="LSQ himself writes 'estimated'; the Tale rounds to 'about 80 miles'. Marked disputed because the two provided sources give different figures and the point cannot be fixed."),
 dict(id="pl_buckland_westfork", label="West Fork (ascended 'a few miles')", attested=[("'On the return trip I ascended the West Fork a few miles'","LSQ report 1 Oct 1908")], role="1908: between 28 July and 5 Aug",
      lat=65.8183, lon=-160.6625, tier=2, precision="river-mouth", status="approximate", radius_km=15,
      coord_source=gnis(1414261,"West Fork Buckland River","Stream",65.8183333,-160.6625), crosscheck=[],
      why="Identification of LSQ's 'West Fork' with GNIS 'West Fork Buckland River' is a name match; the point is the fork's mouth per GNIS."),
 dict(id="pl_eschscholtz_east_end", label="Extreme eastern end of Eschscholtz Bay (Beechey's 'mud' banks)", attested=[("'a small stream where \"mud\" banks were reported by Beechey in 1826, but found sand bluffs and no fossils'","LSQ report 1 Oct 1908")], role="1908: c. 5–10 Aug",
      lat=66.27, lon=-160.90, tier=5, precision="approximate", status="approximate", radius_km=12,
      coord_source=dict(authority="Approximate placement east of the Buckland estuary within GNIS Eschscholtz Bay", id=None, name=None, lat=None, lon=None, url=None),
      why="The stream is unnamed in the report; placed at the head of the bay with a wide halo."),
 dict(id="pl_hotham_peninsula", label="'Hotham Peninsula' (crossed on foot)", attested=[("'crossed Hotham Peninsula to Hotham Inlet'","LSQ report 1 Oct 1908"),("Baldwin Peninsula","GNIS modern name — not in sources")], role="1908: crossed 12 Aug and 17 Aug",
      lat=66.42, lon=-161.85, tier=2, precision="inferred", status="inferred", radius_km=20,
      coord_source=gnis(1412570,"Baldwin Peninsula","Cape",66.5516667,-161.9288889), crosscheck=[wd("Q786427","Baldwin Peninsula",66.5517,-161.9289)],
      why="No GNIS feature is named 'Hotham Peninsula'. The land LSQ crossed on foot from the north shore of Eschscholtz Bay to Hotham Inlet is recorded in GNIS as Baldwin Peninsula; the identification is the model's inference from the described route. The point is set on the southern part of the peninsula, between the two shores named in the report."),
 dict(id="pl_hotham_inlet", label="Hotham Inlet", attested=[("Hotham Inlet","LSQ report 1 Oct 1908")], role="1908: 12–16 Aug, southern and western shores examined", lat=66.5646, lon=-161.7293, tier=2, precision="feature-centroid", status="verified", radius_km=30,
      coord_source=gnis(1413151,"Hotham Inlet","Sea",66.564576,-161.7292924,"Selawik C-6 SE"), crosscheck=[wd("Q5912334","Hotham Inlet",66.8197,-161.965)],
      why="Gazetteer match; the halo covers the shores examined ('many miles of cut silt bluffs')."),
 dict(id="pl_selawik_lake", label="Selawik Lake (south shore)", attested=[("'parts of the south shore of Selawik Lake'","LSQ report 1 Oct 1908")], role="1908: within 12–16 Aug", lat=66.6536, lon=-160.9375, tier=2, precision="feature-centroid", status="verified", radius_km=30,
      coord_source=gnis(1413932,"Selawik Lake","Lake",66.6535568,-160.9374641), crosscheck=[wd("Q3478053","Selawik Lake",66.4942,-160.6908)],
      why="Gazetteer match on the lake; which parts of the south shore were examined is not stated."),
 # ------------------------------------------------------------------ 1908 overland crossing
 dict(id="pl_lanes_landing", label="Lane's Landing / Shelton (head of the Seward Peninsula R.R.)", attested=[("Lane's Landing","LSQ to Bumpus 24 June 1908 ('the head of the railroad'); LSQ report 1908"),("Shelton","PI timeline summarising B.AMNH 26 p.90 ('train to Shelton')")],
      role="1908: railhead reached from Nome, c. 24 June", lat=65.2264, lon=-164.8181, tier=2, precision="settlement", status="disputed", radius_km=10,
      coord_source=gnis(1409420,"Shelton (historical)","Populated Place",65.2263889,-164.8180556,"Bendeleben A-6 NW"), crosscheck=[],
      gnis_note="GNIS has 'Shelton (historical)' but no 'Lanes Landing' in the Alaska file.",
      why="Two names are attested for the railhead by two provided sources (LSQ's letter: Lane's Landing; the Bulletin via the PI: Shelton). Whether they denote the same place is not stated in the provided material; the point uses the GNIS Shelton record and is flagged 'disputed' until the Bulletin text is checked."),
 dict(id="pl_fairbanks", label="Fairbanks", attested=[("Fairbanks","PI timeline: 'Grant to Fairbanks' (B.AMNH 26 p.89)")], role="1907: Madison Grant's destination when the two parted at Fort Gibbon (not an LSQ stop)",
      lat=64.8378, lon=-147.7164, tier=2, precision="settlement", status="verified", radius_km=4,
      coord_source=gnis(1401958,"Fairbanks","Populated Place",64.8377778,-147.7163889), crosscheck=[],
      why="Shown as a secondary node (Grant's divergent route); Grant's movements are otherwise undocumented in the file."),
 dict(id="pl_juneau", label="Juneau (mentioned)", attested=[("'a whaling station near Juneau'","Memorandum [Feb 1908]")], role="mentioned only", lat=58.3019, lon=-134.4197, tier=2, precision="settlement", status="verified", radius_km=4,
      coord_source=gnis(1404263,"Juneau","Populated Place",58.3019444,-134.4197222), crosscheck=[], why="Not visited; listed for completeness of attested place-names.", mentioned_only=True),
 dict(id="pl_norton_bay", label="Norton Bay / Koyuk River (mentioned)", attested=[("'The Koyuk River, flowing into Norton Bay, is another promising locality'","LSQ 27 Mar 1908")], role="mentioned only; not visited", lat=64.7061, lon=-161.2389, tier=2, precision="feature-centroid", status="verified", radius_km=25,
      coord_source=gnis(1407261,"Norton Bay","Bay",64.7061111,-161.2388889), crosscheck=[gnis(1404983,"Koyuk River","Stream",64.9291667,-161.1341667)], why="Attested as a prospective locality only.", mentioned_only=True),
 # ------------------------------------------------------------------ unlocated places (findings)
 dict(id="pl_reported_mammoth", label="Site of the reported frozen mammoth (UNLOCATED)", attested=[("'imbedded in a glacier in a kind of cavern ... in the rocks in the hill side'; 'The country is heavily timbered'","Startsman and Graham 30 Dec 1906"),("'some two hundred miles up the Yukon River from Nome'","Bumpus to Jesup 28 June 1907"),("'you might feel that for the present at least you would not want to disclose the place'","Reed to Startsman 18 Oct 1906")],
      role="object of the 1907 reconnaissance; never shown to Quackenbush", lat=None, lon=None, tier=None, precision="unlocated", status="unlocated", radius_km=None, coord_source=None,
      why="The location was deliberately withheld by the claimants and the AMNH offered to 'guarantee under bond ... not to reveal the locality'. No coordinate is possible or appropriate; the map shows a label, not a point."),
 dict(id="pl_stones_camp", label="'Stone's camp' (UNLOCATED)", attested=[("'This locality [Eschscholtz Bay] is only 30 miles from Stone's camp'","Osborn to Bumpus 20 June 1907"),("'Mr. Grants camp on big bone beach'","Bumpus instructions 29 June 1907 (pencil insertion)"),("'his ranch near Nome'","Tale (PI) on Grant")],
      role="Taylor Creek Ditch Co. operation; Grant's destination", lat=None, lon=None, tier=None, precision="unlocated", status="disputed", radius_km=None, coord_source=None,
      why="Three provided statements place Grant's/Stone's base differently (30 miles from Eschscholtz Bay; on 'big bone beach' itself; 'near Nome'). The company name matches a GNIS 'Taylor Creek' on the Seward Peninsula, but no source links them; not placed."),
 dict(id="pl_coffee_creek", label="Coffee Creek, Alaska (1914 hair sample; UNLOCATED)", attested=[("'hairs of Mammoth | Coffee Creek Alaska'","envelope with LSQ to Grant 2 Aug 1914"),("'I know the location of Coffee Creek'","Grant to Lucas 10 Aug 1914")],
      role="source of the 1914 hair sample", lat=None, lon=None, tier=None, precision="unlocated", status="unlocated", radius_km=None, coord_source=None,
      gnis_note="GNIS lists six streams named Coffee Creek in Alaska (Copper River; Matanuska-Susitna; Nome CA; Lake and Peninsula; Kenai Peninsula; Yukon-Koyukuk CA).",
      why="The sources do not say which Coffee Creek; Grant 'know[s] the location' but does not state it. Not placed."),
 dict(id="pl_long_island", label="Long Island (LSQ's summer home)", attested=[("'his summer home on Long Island'","Matthew to Osborn [17 Apr 1907]")], role="condition of LSQ's availability in 1907", lat=None, lon=None, tier=None, precision="unlocated", status="unlocated", radius_km=None, coord_source=None, why="Region only; not geocoded.", mentioned_only=True),
 dict(id="pl_maine_1914", label="Brassua Lake Camp / Tarratine / Somerset Junction, Maine (1914)", attested=[("Brassua Lake Camp, Maine","LSQ to Grant 2 Aug 1914"),("c/o A.H. Woods, Tarratine, Maine","same"),("telegraph to Somerset Junction","same")], role="LSQ's whereabouts, August 1914", lat=None, lon=None, tier=None, precision="unlocated", status="unlocated", radius_km=None, coord_source=None, why="Outside the journey scope; not geocoded in this build (GNIS Maine file not downloaded).", mentioned_only=True),
 dict(id="pl_seward_uncertain", label="'Seward(?)' — Anderson's letter of 18 May [1907] (place uncertain)", attested=[("Seward(?)","PI header for Anderson to Stone, 18 May; the query mark is the PI's")], role="place of writing of Anderson's withdrawal (uncertain)", lat=None, lon=None, tier=None, precision="unlocated", status="disputed", radius_km=None, coord_source=None,
      gnis_note="GNIS 1414598 'Seward' (Populated Place, Kenai Peninsula) exists, but the PI could not read the place-name with confidence; the letter is on Northwestern Steamship Co. (Seattle) letterhead.",
      why="Not placed: the reading is uncertain and the letterhead points elsewhere.", mentioned_only=True),
 # ------------------------------------------------------------------ prologue context (Tale §1), off by default
 dict(id="pl_lena_mouth", label="Mouth of the Lena River (Adams mammoth, 1799–1806)", attested=[("'near the mouth of the Lena River in Siberia'","Tale §1"),("'a narrow peninsula'","Tale §1")], role="context: find-site of the Adams mammoth (Tale §1)", lat=72.98, lon=126.19, tier=2, precision="approximate", status="approximate", radius_km=120,
      coord_source=geonames(2056283,"Lena Delta",72.9648,126.1853), crosscheck=[wd("Q2298744","Lena Delta",72.9776,126.0681)], scope="prologue",
      why="The Tale gives no coordinates and names no peninsula; the GeoNames Lena Delta point stands for 'the mouth of the Lena' with a 120 km halo."),
 dict(id="pl_yakutsk", label="Yakutsk", attested=[("Yakutsk","Tale §1")], role="context: where Adams learned of the find (1806)", lat=62.0272, lon=129.7319, tier=2, precision="settlement", status="verified", radius_km=8,
      coord_source=geonames(2013159,"Yakutsk",62.0272,129.7319), crosscheck=[wd("Q6610","Yakutsk",62.0272,129.7319)], scope="prologue", why="Gazetteer match."),
 dict(id="pl_stpetersburg", label="St Petersburg", attested=[("St Petersburg","Tale §1")], role="context: destination of the Adams mammoth; Academy of Science", lat=59.95, lon=30.3167, tier=2, precision="settlement", status="verified", radius_km=10,
      coord_source=geonames(498817,"Saint Petersburg",59.9386,30.3141), crosscheck=[wd("Q656","Saint Petersburg",59.95,30.3167)], scope="prologue", why="Gazetteer match."),
]
