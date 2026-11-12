"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import TableauEmbed from "@/conmponents/TableauEmbed";

// Converts ALL-CAPS species labels to Title Case for display
function toTitleCase(str: string): string {
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

// Returns a Tailwind class string for the IUCN conservation status badge color
function getStatusColor(status: string): string {
    switch (status?.toUpperCase()) {
        case "CRITICALLY ENDANGERED": return "bg-[#333333] text-white";
        case "ENDANGERED":            return "bg-[#FF8A2A] text-white";
        case "VULNERABLE":            return "bg-[#ffbc88] text-[#333333]";
        case "NEAR THREATENED":       return "bg-[#fff99d] text-[#333333]";
        case "LEAST CONCERN":         return "bg-[#fffdde] text-[#333333]";
        default:                      return "bg-[#C9C9C9] text-[#333333]";
    }
}

// Maps ISO 3166-1 alpha-2 country codes to their full English names
const COUNTRY_NAMES: Record<string, string> = {
    AF:"Afghanistan",AL:"Albania",DZ:"Algeria",AD:"Andorra",AO:"Angola",AG:"Antigua and Barbuda",
    AR:"Argentina",AM:"Armenia",AU:"Australia",AT:"Austria",AZ:"Azerbaijan",BS:"Bahamas",BH:"Bahrain",
    BD:"Bangladesh",BB:"Barbados",BY:"Belarus",BE:"Belgium",BZ:"Belize",BJ:"Benin",BT:"Bhutan",
    BO:"Bolivia",BA:"Bosnia and Herzegovina",BW:"Botswana",BR:"Brazil",BN:"Brunei",BG:"Bulgaria",
    BF:"Burkina Faso",BI:"Burundi",CV:"Cape Verde",KH:"Cambodia",CM:"Cameroon",CA:"Canada",
    CF:"Central African Republic",TD:"Chad",CL:"Chile",CN:"China",CO:"Colombia",KM:"Comoros",
    CG:"Congo",CD:"DR Congo",CR:"Costa Rica",HR:"Croatia",CU:"Cuba",CY:"Cyprus",CZ:"Czech Republic",
    DK:"Denmark",DJ:"Djibouti",DM:"Dominica",DO:"Dominican Republic",EC:"Ecuador",EG:"Egypt",
    SV:"El Salvador",GQ:"Equatorial Guinea",ER:"Eritrea",EE:"Estonia",SZ:"Eswatini",ET:"Ethiopia",
    FJ:"Fiji",FI:"Finland",FR:"France",GA:"Gabon",GM:"Gambia",GE:"Georgia",DE:"Germany",GH:"Ghana",
    GR:"Greece",GD:"Grenada",GT:"Guatemala",GN:"Guinea",GW:"Guinea-Bissau",GY:"Guyana",HT:"Haiti",
    HN:"Honduras",HU:"Hungary",IS:"Iceland",IN:"India",ID:"Indonesia",IR:"Iran",IQ:"Iraq",IE:"Ireland",
    IL:"Israel",IT:"Italy",JM:"Jamaica",JP:"Japan",JO:"Jordan",KZ:"Kazakhstan",KE:"Kenya",KI:"Kiribati",
    KW:"Kuwait",KG:"Kyrgyzstan",LA:"Laos",LV:"Latvia",LB:"Lebanon",LS:"Lesotho",LR:"Liberia",
    LY:"Libya",LI:"Liechtenstein",LT:"Lithuania",LU:"Luxembourg",MG:"Madagascar",MW:"Malawi",
    MY:"Malaysia",MV:"Maldives",ML:"Mali",MT:"Malta",MH:"Marshall Islands",MR:"Mauritania",
    MU:"Mauritius",MX:"Mexico",FM:"Micronesia",MD:"Moldova",MC:"Monaco",MN:"Mongolia",ME:"Montenegro",
    MA:"Morocco",MZ:"Mozambique",MM:"Myanmar",NA:"Namibia",NR:"Nauru",NP:"Nepal",NL:"Netherlands",
    NZ:"New Zealand",NI:"Nicaragua",NE:"Niger",NG:"Nigeria",NO:"Norway",OM:"Oman",PK:"Pakistan",
    PW:"Palau",PA:"Panama",PG:"Papua New Guinea",PY:"Paraguay",PE:"Peru",PH:"Philippines",PL:"Poland",
    PT:"Portugal",QA:"Qatar",RO:"Romania",RU:"Russia",RW:"Rwanda",KN:"Saint Kitts and Nevis",
    LC:"Saint Lucia",VC:"Saint Vincent and the Grenadines",WS:"Samoa",SM:"San Marino",
    ST:"Sao Tome and Principe",SA:"Saudi Arabia",SN:"Senegal",RS:"Serbia",SC:"Seychelles",
    SL:"Sierra Leone",SG:"Singapore",SK:"Slovakia",SI:"Slovenia",SB:"Solomon Islands",SO:"Somalia",
    ZA:"South Africa",SS:"South Sudan",ES:"Spain",LK:"Sri Lanka",SD:"Sudan",SR:"Suriname",SE:"Sweden",
    CH:"Switzerland",SY:"Syria",TW:"Taiwan",TJ:"Tajikistan",TZ:"Tanzania",TH:"Thailand",TL:"Timor-Leste",
    TG:"Togo",TO:"Tonga",TT:"Trinidad and Tobago",TN:"Tunisia",TR:"Turkey",TM:"Turkmenistan",
    TV:"Tuvalu",UG:"Uganda",UA:"Ukraine",AE:"United Arab Emirates",GB:"United Kingdom",US:"United States",
    UY:"Uruguay",UZ:"Uzbekistan",VU:"Vanuatu",VE:"Venezuela",VN:"Vietnam",YE:"Yemen",ZM:"Zambia",ZW:"Zimbabwe",
};

// Converts a 2-letter country code to its full name, falling back to the code itself if unknown
function getCountryName(code: string): string {
    return COUNTRY_NAMES[code?.toUpperCase()] ?? code;
}

// Strips NaN, null, empty strings, and other junk values from a prey list
function cleanPreyList(list: any[]): string[] {
    return (list ?? [])
        .map((item: any) => String(item ?? "").trim())
        .filter(str => {
            if (str === "") return false;
            const lower = str.toLowerCase();
            return lower !== "nan" && lower !== "null" && lower !== "undefined";
        });
}

// The prediction page — users upload a bird photo and the ML model identifies the species
export default function PredictPage() {

    // The file the user has selected or dropped
    const [file,       setFile]       = useState<File | null>(null);

    // Object URL used to preview the uploaded image before submission
    const [preview,    setPreview]    = useState<string | null>(null);

    // Which tab is currently active in the bird info section
    const [activeTab,  setActiveTab]  = useState<"diet" | "taxonomy" | "history" | "plumage" | "migration">("diet");

    // Wikimedia plumage image URLs fetched for the current prediction
    const [plumageImages,   setPlumageImages]   = useState<string[]>([]);

    // True while the plumage image request is in flight
    const [plumageLoading,  setPlumageLoading]  = useState(false);

    // Tracks which species label was last fetched so we don't re-fetch on every tab switch
    const plumageLoadedFor = useRef<string | null>(null);

    // True while waiting for the API to return a prediction
    const [loading,    setLoading]    = useState(false);

    // The full response object returned by POST /predict
    const [result,     setResult]     = useState<any | null>(null);

    // The species image fetched from /bird/{label}/image after a successful prediction
    const [birdImage,  setBirdImage]  = useState<string | null>(null);

    // Error message shown when the file type is invalid or the API returns an error field
    const [apiError,   setApiError]   = useState<string | null>(null);

    // Ref to the hidden file input so the upload label click can open the browser file picker
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Called when the user picks a file — either by label click or browsing
    function handleFile(picked: File) {
        // Check the file type before doing anything else
        const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
        if (!allowed.includes(picked.type)) {
            setApiError("Only JPG, PNG, and WEBP images are supported.");
            return;
        }
        // Clear any previous error, result, or bird image
        setApiError(null);
        setResult(null);
        setBirdImage(null);
        // Revoke the old object URL to free memory, then create a new one for the preview
        if (preview) URL.revokeObjectURL(preview);
        setFile(picked);
        setPreview(URL.createObjectURL(picked));
    }

    // Handles a file selected through the browser file picker
    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        const picked = e.target.files?.[0];
        if (picked) handleFile(picked);
    }

    // Resets all state back to the initial empty upload state
    function handleClear() {
        if (preview) URL.revokeObjectURL(preview);
        setFile(null);
        setPreview(null);
        setResult(null);
        setBirdImage(null);
        setApiError(null);
        // Reset the hidden input so the same file can be re-selected if needed
        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    // Fetches Wikimedia plumage images the first time the Plumage tab is opened for a prediction
    useEffect(() => {
        const label = result?.prediction?.species_label;
        if (activeTab !== "plumage" || !label || plumageLoadedFor.current === label) return;
        // Mark this label as in-flight so switching tabs and back doesn't re-fetch
        plumageLoadedFor.current = label;
        setPlumageLoading(true);
        setPlumageImages([]);
        fetch(`http://127.0.0.1:8000/bird/${encodeURIComponent(label)}/plumage`)
            .then(r => r.json())
            .then(data => setPlumageImages(data.images ?? []))
            .catch(() => setPlumageImages([]))
            .finally(() => setPlumageLoading(false));
    }, [activeTab, result]);

    // Submits the selected image to the prediction API
    async function handleSubmit() {
        if (!file) return;
        setLoading(true);
        setApiError(null);
        setResult(null);
        setBirdImage(null);
        // Declared outside try so the image fetch below can access it after the block
        let data: any = null;
        try {
            // Build multipart form data — the API expects the file under the key "file"
            const form = new FormData();
            form.append("file", file);
            const res = await fetch("http://127.0.0.1:8000/predict", { method: "POST", body: form });
            data = await res.json();
            // If the API returned a top-level error field, show it and stop
            if (data.error) { setApiError(data.error); setLoading(false); return; }
            // If the model wasn't confident enough, show an error and stop
            if (!data.prediction?.accepted) {
                const pct = data.prediction?.confidence != null
                    ? ` (best guess confidence: ${(data.prediction.confidence * 100).toFixed(1)}%)`
                    : "";
                setApiError(`The model wasn't confident enough to identify this bird${pct}. Try a clearer photo with the bird as the main subject.`);
                setLoading(false);
                return;
            }
            setResult(data);
        } catch {
            setApiError("Could not reach the prediction server. Make sure the API is running.");
            setLoading(false);
            return;
        }
        setLoading(false);
        // Fetch the species image separately — a failure here should not affect the prediction result
        const label = data?.prediction?.species_label;
        if (label) {
            fetch(`http://127.0.0.1:8000/bird/${encodeURIComponent(label)}/image`)
                .then(res => { if (!res.ok) throw new Error("Image fetch failed"); return res.blob(); })
                .then(blob => { setBirdImage(URL.createObjectURL(blob)); })
                .catch(() => console.error("Could not load species image for", label));
        }
    }

    return (
        // Two-panel layout: fixed left aside for upload controls, flex-1 right area for results
        <main className="flex-1 min-w-0 flex items-stretch bg-[#f8f9f9]">

            {/* ── Left aside: upload controls ───────────────────────────────────── */}
            <aside
                className="w-[340px] flex-none bg-white border-r border-[#e3e6e8] p-6 flex flex-col gap-4 sticky top-[50px] self-start box-border overflow-y-auto"
                style={{ minHeight: "calc(100vh - 50px)" }}
            >
                {/* Title and description */}
                <div>
                    <h1 className="text-xl font-bold text-[#232629]">Identify a Bird</h1>
                    <p className="text-sm text-[#6a737c] mt-1.5 leading-relaxed">
                        Upload a photo and our model will identify the species from 525 possibilities.
                    </p>
                </div>

                {/* Image preview — shows the selected photo before submission */}
                <div className="h-[200px] rounded-lg overflow-hidden relative bg-[#f1f2f3] border border-[#e3e6e8]">
                    {preview ? (
                        <img src={preview} alt="Upload preview" className="w-full h-full object-cover" />
                    ) : (
                        // Placeholder shown before any file is selected
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <div className="text-3xl opacity-20">🖼️</div>
                                <p className="text-xs text-[#9199a1] mt-1">Photo preview</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* File chooser — a styled label that triggers the hidden file input */}
                <label className="flex flex-col items-center gap-1 p-4 border-2 border-dashed border-[#babfc4] rounded-lg bg-[#f8f9f9] cursor-pointer text-center hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    <span className="text-sm font-semibold text-blue-600">Choose a Photo</span>
                    <span className="text-xs text-[#9199a1]">{file ? file.name : "JPG, PNG or WEBP"}</span>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        className="hidden"
                        onChange={handleInputChange}
                    />
                </label>

                {/* Error message — invalid file type or API error */}
                {apiError && (
                    <p className="text-xs text-red-600 font-medium leading-relaxed">{apiError}</p>
                )}

                {/* Identify + Clear buttons */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !file}
                        className="px-4 py-2 bg-[#ffbc88] text-[#232629] font-semibold text-sm rounded hover:bg-[#ff9f5a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Identifying…" : "Identify Species"}
                    </button>
                    {(file || result) && (
                        <button
                            onClick={handleClear}
                            className="text-sm text-[#6a737c] hover:text-[#232629] transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {/* Info box — file type guidance */}
                <div className="bg-[#e8f4fd] border border-[#b3d9f7] rounded-lg p-3 text-xs leading-relaxed text-[#2d6fa9]">
                    <span className="font-semibold">Accepted file types:</span> JPG, PNG, and WEBP images only.
                    For best results, use a clear photo where the bird is the main subject and well lit.
                </div>
            </aside>

            {/* ── Right main: results ───────────────────────────────────────────── */}
            <div className="flex-1 min-w-0 p-6 flex flex-col gap-5">

                {/* Prediction result card — only shown after a confident prediction */}
                {result?.prediction?.accepted ? (
                    <>
                        {/* Result summary: species image + name + confidence + top-5 bars */}
                        <div className="bg-white border border-[#e3e6e8] rounded-lg p-6 flex flex-wrap gap-6 items-center shadow-sm" style={{ borderTop: "3px solid #ffbc88" }}>

                            {/* Species image from the dataset */}
                            <div className="w-[200px] h-[150px] flex-none rounded-lg overflow-hidden bg-[#f1f2f3]">
                                {birdImage ? (
                                    <img src={birdImage} alt={toTitleCase(result.prediction.species_label)} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-[#e3e6e8] animate-pulse rounded-lg" />
                                )}
                            </div>

                            {/* Predicted name and confidence badge */}
                            <div className="flex-1 min-w-[180px]">
                                <div className="text-[11px] uppercase tracking-widest text-[#9199a1] mb-1">Prediction Result</div>
                                <div className="text-2xl font-bold text-[#232629] leading-tight">
                                    {toTitleCase(result.prediction.species_label)}
                                </div>
                                <span className="inline-block mt-2 bg-green-100 border border-green-200 text-green-700 font-semibold text-sm px-3 py-0.5 rounded-full">
                                    {(result.prediction.confidence * 100).toFixed(1)}% confidence
                                </span>
                            </div>

                            {/* Top 5 predictions — name + proportional bar + percentage */}
                            {result.prediction.top_5_predictions?.length > 0 && (
                                <div className="w-[300px] max-w-full flex flex-col gap-1.5">
                                    {result.prediction.top_5_predictions.map((item: any, i: number) => (
                                        <div key={i} className="flex gap-2 items-center text-xs">
                                            <span className={`w-36 ${i === 0 ? "font-semibold text-[#232629]" : "text-[#6a737c]"}`}>
                                                {toTitleCase(item.species_label)}
                                            </span>
                                            <div className="flex-1 h-1.5 bg-[#e3e6e8] rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${i === 0 ? "bg-green-500" : "bg-blue-300"}`}
                                                    style={{ width: `${Math.max(item.confidence * 100, 1)}%` }}
                                                />
                                            </div>
                                            <span className="w-10 text-right text-[#9199a1]">
                                                {(item.confidence * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Bird info tabs — Diet, Taxonomy, History, Plumage, Migration */}
                        <div className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden">

                            {/* Tab button row */}
                            <div className="flex flex-wrap border-b border-[#e3e6e8] px-3">
                                {(["diet", "taxonomy", "history", "plumage", "migration"] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`px-3.5 py-3 text-sm border-b-[3px] -mb-px transition-colors font-medium ${
                                            activeTab === tab
                                                ? "border-[#ffbc88] text-[#232629] font-semibold"
                                                : "border-transparent text-[#6a737c] hover:text-[#232629]"
                                        }`}
                                    >
                                        {tab === "diet" && "Diet"}
                                        {tab === "taxonomy" && "Family & Taxonomy"}
                                        {tab === "history" && "History"}
                                        {tab === "plumage" && "Plumage"}
                                        {tab === "migration" && "Migration"}
                                    </button>
                                ))}
                            </div>

                            {/* Tab content */}
                            <div className="p-5">

                                {/* Diet tab — prey items as a table */}
                                {activeTab === "diet" && (() => {
                                    const bird = result.bird;
                                    const names   = cleanPreyList(bird?.diet?.prey_common_names ?? bird?.diet?.top_prey ?? []);
                                    const classes: string[] = bird?.diet?.prey_classes ?? [];
                                    return names.length > 0 ? (
                                        <div className="overflow-x-auto rounded-lg border border-[#e3e6e8]">
                                            <table className="w-full text-sm border-collapse">
                                                <thead>
                                                    <tr className="bg-[#f8f9f9]">
                                                        <th className="px-4 py-3 text-left font-semibold text-[#232629] border-b border-[#e3e6e8]">Prey Common Name</th>
                                                        <th className="px-4 py-3 text-left font-semibold text-[#232629] border-b border-[#e3e6e8]">Prey Class</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {names.map((name, i) => (
                                                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#f8f9f9]"}>
                                                            <td className="px-4 py-3 text-[#232629]">{name}</td>
                                                            <td className="px-4 py-3 text-[#6a737c]">{classes[i] ?? "—"}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-[#9199a1] italic">No diet data available for this species.</p>
                                    );
                                })()}

                                {/* Family & Taxonomy tab — scientific classification */}
                                {activeTab === "taxonomy" && (() => {
                                    const bird = result.bird;
                                    const tax  = bird?.taxonomy;
                                    const rows = [
                                        { label: "Class",  definition: "The broadest grouping — all birds belong to the class Aves.",                                     value: tax?.class,  highlight: false },
                                        { label: "Order",  definition: "A group of related families that share common ancestry.",                                          value: tax?.order,  highlight: false },
                                        { label: "Family", definition: "A group of closely related genera that share distinctive traits.",                                  value: tax?.family, highlight: true  },
                                        { label: "Genus",  definition: "A group of closely related species sharing a common ancestor and many physical characteristics.",   value: tax?.genus,  highlight: true  },
                                    ];
                                    return (
                                        <div className="flex flex-col gap-5">
                                            {/* Scientific name displayed prominently above the table */}
                                            <div className="bg-[#f8f9f9] rounded-lg px-5 py-4">
                                                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9199a1] mb-1">Scientific Name</p>
                                                <p className="text-xl italic text-[#232629] font-semibold">{bird?.scientific_name ?? "—"}</p>
                                                <p className="text-sm text-[#9199a1] mt-1">Common name: {toTitleCase(result.prediction.species_label)}</p>
                                            </div>
                                            <div className="overflow-x-auto rounded-lg border border-[#e3e6e8]">
                                                <table className="w-full text-sm border-collapse">
                                                    <thead>
                                                        <tr className="bg-[#f8f9f9]">
                                                            <th className="px-4 py-3 text-left font-semibold text-[#232629] border-b border-[#e3e6e8] w-1/3">Rank</th>
                                                            <th className="px-4 py-3 text-left font-semibold text-[#232629] border-b border-[#e3e6e8]">Name</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {rows.map((row, i) => (
                                                            <tr key={i} className={row.highlight ? "bg-[#fdf2d8]" : i % 2 === 0 ? "bg-white" : "bg-[#f8f9f9]"}>
                                                                <td className="px-4 py-3">
                                                                    <p className="font-semibold text-[#232629]">{row.label}</p>
                                                                    <p className="text-xs text-[#9199a1] mt-0.5">{row.definition}</p>
                                                                </td>
                                                                <td className="px-4 py-3 text-[#6a737c]">{row.value ?? "—"}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* History tab — Wikipedia extract split into paragraphs */}
                                {activeTab === "history" && (() => {
                                    const bird = result.bird;
                                    const extract: string = bird?.wikipedia?.extract ?? "";
                                    const paragraphs = extract.split("\n").map((p: string) => p.trim()).filter((p: string) => p.length > 0);
                                    return (
                                        <div className="flex flex-col gap-5">
                                            <div className="bg-[#f8f9f9] rounded-lg px-5 py-4">
                                                <p className="font-bold text-[#232629]">{toTitleCase(result.prediction.species_label)}</p>
                                                <p className="text-sm text-[#9199a1] mt-0.5 italic">Wikipedia overview</p>
                                            </div>
                                            {paragraphs.length > 0 ? (
                                                <div className="flex flex-col gap-3">
                                                    {paragraphs.map((para: string, i: number) => (
                                                        <p key={i} className="text-sm text-[#6a737c] leading-relaxed">{para}</p>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-[#9199a1] italic">No Wikipedia information available for this species.</p>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Plumage tab — Wikimedia Commons photo gallery + description text */}
                                {activeTab === "plumage" && (() => {
                                    const sections: Record<string, string> = result.bird?.wikipedia?.sections ?? {};
                                    // Use Description first (covers appearance), fall back to Subspecies
                                    const text = sections["Description"] ?? sections["Subspecies"] ?? null;
                                    return (
                                        <div className="flex flex-col gap-5">
                                            {plumageLoading ? (
                                                // Skeleton placeholders while images load
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="h-44 bg-[#e3e6e8] animate-pulse rounded-lg" />
                                                    <div className="h-44 bg-[#e3e6e8] animate-pulse rounded-lg" />
                                                </div>
                                            ) : plumageImages.length > 0 ? (
                                                // 2-column grid of Wikimedia photos
                                                <div className="grid grid-cols-2 gap-3">
                                                    {plumageImages.map((url, i) => (
                                                        <img key={i} src={url} alt={`Plumage photo ${i + 1}`} className="w-full h-44 object-cover rounded-lg" />
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-[#9199a1] italic">No plumage images found for this species.</p>
                                            )}
                                            {text ? (
                                                <div>
                                                    <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9199a1] mb-2">Description</p>
                                                    <p className="text-sm text-[#6a737c] leading-relaxed">{text}</p>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-[#9199a1] italic">No plumage description available for this species.</p>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Migration tab — movement pattern, top countries, and Tableau maps */}
                                {activeTab === "migration" && (() => {
                                    const bird = result.bird;
                                    const movement      = bird?.conservation?.movement_patterns;
                                    const topCountries: { country: string; count: number }[] = bird?.migration?.top_countries ?? [];
                                    const totalSightings: number | null = bird?.migration?.total_sightings ?? null;
                                    return (
                                        <div className="flex flex-col gap-5">
                                            {/* Movement pattern + total sightings cards */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="bg-[#f8f9f9] rounded-lg px-5 py-4">
                                                    <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9199a1] mb-1">Movement Pattern</p>
                                                    <p className="font-bold text-[#232629] text-lg">{movement ?? "—"}</p>
                                                </div>
                                                <div className="bg-[#f8f9f9] rounded-lg px-5 py-4">
                                                    <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9199a1] mb-1">Total Recorded Sightings</p>
                                                    <p className="font-bold text-[#232629] text-lg">
                                                        {totalSightings != null ? totalSightings.toLocaleString() : "—"}
                                                    </p>
                                                </div>
                                            </div>
                                            {/* Top countries ranked by sighting count */}
                                            {topCountries.length > 0 && (
                                                <div className="rounded-lg border border-[#e3e6e8] overflow-hidden">
                                                    <div className="bg-[#f8f9f9] px-4 py-2.5 border-b border-[#e3e6e8]">
                                                        <p className="font-semibold text-[#232629] text-sm">Top Sighting Countries</p>
                                                    </div>
                                                    <div className="divide-y divide-[#e3e6e8]">
                                                        {topCountries.slice(0, 8).map((entry, i) => {
                                                            const max = topCountries[0]?.count ?? 1;
                                                            const pct = Math.round((entry.count / max) * 100);
                                                            return (
                                                                <div key={i} className="px-4 py-2.5 flex items-center gap-3 bg-white">
                                                                    <span className="text-xs font-mono text-[#9199a1] w-4 shrink-0">{i + 1}</span>
                                                                    <span className="text-sm text-[#232629] w-32 shrink-0">{getCountryName(entry.country)}</span>
                                                                    <div className="flex-1 h-2 rounded-full bg-[#e3e6e8]">
                                                                        <div className="h-2 rounded-full bg-[#ffbc88]" style={{ width: `${pct}%` }} />
                                                                    </div>
                                                                    <span className="text-xs font-mono text-[#9199a1] w-14 text-right shrink-0">
                                                                        {entry.count.toLocaleString()}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                            {/* Tableau embeds for occurrence and trend data */}
                                            <div>
                                                <p className="text-sm font-semibold text-[#232629] mb-2">Occurrence Map</p>
                                                <TableauEmbed url={process.env.NEXT_PUBLIC_BIRD_OCCURRENCE!} title="Individual Bird Occurrence" height="500px" speciesFilter={result?.prediction?.species_label} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-[#232629] mb-2">Monthly Sightings Over Time</p>
                                                <TableauEmbed url={process.env.NEXT_PUBLIC_MONTHLY_SIGHTING_OVERTIME!} title="Monthly Sighting Over Time" height="500px" speciesFilter={result?.prediction?.species_label} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-[#232629] mb-2">Observation Trends by Year</p>
                                                <TableauEmbed url={process.env.NEXT_PUBLIC_OBSERVATION_BY_YEAR!} title="Observation Trends by Year" height="500px" speciesFilter={result?.prediction?.species_label} />
                                            </div>
                                        </div>
                                    );
                                })()}

                            </div>
                        </div>
                    </>
                ) : (
                    // Empty state — shown before any prediction is made
                    <div className="bg-white border-2 border-dashed border-[#d6d9dc] rounded-lg p-16 text-center text-sm text-[#6a737c]">
                        Choose a photo and select Identify Species to see the prediction.
                    </div>
                )}

                {/* What's next — always visible action cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white border border-[#e3e6e8] rounded-lg p-4 flex flex-col gap-1.5 hover:border-blue-300 hover:shadow-md transition-all">
                        <span className="font-semibold text-sm text-blue-600">Try Another Photo →</span>
                        <span className="text-xs leading-relaxed text-[#6a737c]">Upload a different image and see if the model can identify another species.</span>
                        <button
                            onClick={() => { handleClear(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                            className="mt-2 self-start text-xs font-semibold text-[#232629] underline hover:no-underline"
                        >
                            Upload a New Photo
                        </button>
                    </div>
                    <Link href="/bird" className="bg-white border border-[#e3e6e8] rounded-lg p-4 flex flex-col gap-1.5 hover:border-blue-300 hover:shadow-md transition-all">
                        <span className="font-semibold text-sm text-blue-600">Explore a Species →</span>
                        <span className="text-xs leading-relaxed text-[#6a737c]">Browse the list of all 525 species and dive into their full profile.</span>
                    </Link>
                    <Link href="/species" className="bg-white border border-[#e3e6e8] rounded-lg p-4 flex flex-col gap-1.5 hover:border-blue-300 hover:shadow-md transition-all">
                        <span className="font-semibold text-sm text-blue-600">Compare Species →</span>
                        <span className="text-xs leading-relaxed text-[#6a737c]">Select up to 6 birds and compare their taxonomy, diet, and migration side by side.</span>
                    </Link>
                </div>

                {/* AI Prediction Disclaimer */}
                <div className="bg-[#fdf2d8] border border-[#e6d8a7] rounded-lg p-4 flex gap-3 items-start">
                    <span className="text-lg flex-none">⚠️</span>
                    <div>
                        <div className="font-semibold text-sm text-[#232629] mb-1">AI Prediction Disclaimer</div>
                        <div className="text-sm text-[#6a737c] leading-relaxed">
                            AI predictions may not always be accurate. Please verify results using reliable sources before making decisions.
                        </div>
                    </div>
                </div>

            </div>
        </main>
    );
}
