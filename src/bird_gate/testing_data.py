import pandas as pd, glob
from pathlib import Path

RAW = Path(__file__).resolve().parents[2] / "data"/"bird_gate" / "raw"   # src/bird_gate/ -> project root
print("Looking in:", RAW, "| exists:", RAW.exists())

files = glob.glob(str(RAW / "manifest_*.csv"))
print("Manifests found:", [Path(f).name for f in files])
m = pd.concat([pd.read_csv(f) for f in files])

cal = m[m.source == "caltech"]
print("Caltech classes kept:", cal.orig_class.nunique())
print("Removed classes still present (must be empty):",
      sorted(set(cal.orig_class) & {"cormorant","duck","goose","hummingbird","ibis","ostrich","owl","penguin","swan","birdbath"}))
print("Hard classes found:", sorted(c for c in cal.orig_class.unique()
      if c in {"airplanes","fighter_jet","helicopter","hot_air_balloon","blimp","bat","butterfly","house_fly"}), "\n")

aves = m[m.source == "aves_tolima"]
print("Aves species:", aves.orig_class.nunique(), "(expect 11)")
print(aves.groupby("orig_class").size(), "\n")

places = m[m.source == "places365"]
print("Places scenes:", places.orig_class.nunique())
print("Needed scenes missing:", sorted({"sky","skyscraper","snowfield","volcano","runway","hangar_outdoor","oilrig","lighthouse"} - set(places.orig_class)))
print(m.groupby(["source", "label"]).size())