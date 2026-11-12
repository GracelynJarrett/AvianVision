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
        case "ENDANGERED": return "bg-[#FF8A2A] text-white";
        case "VULNERABLE": return "bg-[#ffbc88] text-[#333333]";
        case "NEAR THREATENED": return "bg-[#fff99d] text-[#333333]";
        case "LEAST CONCERN": return "bg-[#fffdde] text-[#333333]";
        default: return "bg-[#C9C9C9] text-[#333333]";
    }
}

// Maps ISO 3166-1 alpha-2 country codes to their full English names
const COUNTRY_NAMES: Record<string, string> = {
    AF: "Afghanistan", AL: "Albania", DZ: "Algeria", AD: "Andorra", AO: "Angola",
    AG: "Antigua and Barbuda", AR: "Argentina", AM: "Armenia", AU: "Australia",
    AT: "Austria", AZ: "Azerbaijan", BS: "Bahamas", BH: "Bahrain", BD: "Bangladesh",
    BB: "Barbados", BY: "Belarus", BE: "Belgium", BZ: "Belize", BJ: "Benin",
    BT: "Bhutan", BO: "Bolivia", BA: "Bosnia and Herzegovina", BW: "Botswana",
    BR: "Brazil", BN: "Brunei", BG: "Bulgaria", BF: "Burkina Faso", BI: "Burundi",
    CV: "Cape Verde", KH: "Cambodia", CM: "Cameroon", CA: "Canada",
    CF: "Central African Republic", TD: "Chad", CL: "Chile", CN: "China",
    CO: "Colombia", KM: "Comoros", CG: "Congo", CD: "DR Congo", CR: "Costa Rica",
    HR: "Croatia", CU: "Cuba", CY: "Cyprus", CZ: "Czech Republic", DK: "Denmark",
    DJ: "Djibouti", DM: "Dominica", DO: "Dominican Republic", EC: "Ecuador",
    EG: "Egypt", SV: "El Salvador", GQ: "Equatorial Guinea", ER: "Eritrea",
    EE: "Estonia", SZ: "Eswatini", ET: "Ethiopia", FJ: "Fiji", FI: "Finland",
    FR: "France", GA: "Gabon", GM: "Gambia", GE: "Georgia", DE: "Germany",
    GH: "Ghana", GR: "Greece", GD: "Grenada", GT: "Guatemala", GN: "Guinea",
    GW: "Guinea-Bissau", GY: "Guyana", HT: "Haiti", HN: "Honduras", HU: "Hungary",
    IS: "Iceland", IN: "India", ID: "Indonesia", IR: "Iran", IQ: "Iraq",
    IE: "Ireland", IL: "Israel", IT: "Italy", JM: "Jamaica", JP: "Japan",
    JO: "Jordan", KZ: "Kazakhstan", KE: "Kenya", KI: "Kiribati", KW: "Kuwait",
    KG: "Kyrgyzstan", LA: "Laos", LV: "Latvia", LB: "Lebanon", LS: "Lesotho",
    LR: "Liberia", LY: "Libya", LI: "Liechtenstein", LT: "Lithuania", LU: "Luxembourg",
    MG: "Madagascar", MW: "Malawi", MY: "Malaysia", MV: "Maldives", ML: "Mali",
    MT: "Malta", MH: "Marshall Islands", MR: "Mauritania", MU: "Mauritius",
    MX: "Mexico", FM: "Micronesia", MD: "Moldova", MC: "Monaco", MN: "Mongolia",
    ME: "Montenegro", MA: "Morocco", MZ: "Mozambique", MM: "Myanmar", NA: "Namibia",
    NR: "Nauru", NP: "Nepal", NL: "Netherlands", NZ: "New Zealand", NI: "Nicaragua",
    NE: "Niger", NG: "Nigeria", NO: "Norway", OM: "Oman", PK: "Pakistan",
    PW: "Palau", PA: "Panama", PG: "Papua New Guinea", PY: "Paraguay", PE: "Peru",
    PH: "Philippines", PL: "Poland", PT: "Portugal", QA: "Qatar", RO: "Romania",
    RU: "Russia", RW: "Rwanda", KN: "Saint Kitts and Nevis", LC: "Saint Lucia",
    VC: "Saint Vincent and the Grenadines", WS: "Samoa", SM: "San Marino",
    ST: "Sao Tome and Principe", SA: "Saudi Arabia", SN: "Senegal", RS: "Serbia",
    SC: "Seychelles", SL: "Sierra Leone", SG: "Singapore", SK: "Slovakia",
    SI: "Slovenia", SB: "Solomon Islands", SO: "Somalia", ZA: "South Africa",
    SS: "South Sudan", ES: "Spain", LK: "Sri Lanka", SD: "Sudan", SR: "Suriname",
    SE: "Sweden", CH: "Switzerland", SY: "Syria", TW: "Taiwan", TJ: "Tajikistan",
    TZ: "Tanzania", TH: "Thailand", TL: "Timor-Leste", TG: "Togo", TO: "Tonga",
    TT: "Trinidad and Tobago", TN: "Tunisia", TR: "Turkey", TM: "Turkmenistan",
    TV: "Tuvalu", UG: "Uganda", UA: "Ukraine", AE: "United Arab Emirates",
    GB: "United Kingdom", US: "United States", UY: "Uruguay", UZ: "Uzbekistan",
    VU: "Vanuatu", VE: "Venezuela", VN: "Vietnam", YE: "Yemen", ZM: "Zambia",
    ZW: "Zimbabwe",
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
    const [file, setFile] = useState<File | null>(null);

    // Object URL used to preview the uploaded image before submission
    const [preview, setPreview] = useState<string | null>(null);

    // True when the help steps panel is visible
    const [showHelp, setShowHelp] = useState(false);

    // Which tab is currently active in the bird info section
    const [activeTab, setActiveTab] = useState<"diet" | "taxonomy" | "history" | "plumage" | "migration">("diet");

    // Wikimedia plumage image URLs fetched for the current prediction
    const [plumageImages, setPlumageImages] = useState<string[]>([]);

    // True while the plumage image request is in flight
    const [plumageLoading, setPlumageLoading] = useState(false);

    // Tracks which species label was last fetched so we don't re-fetch on every tab switch
    const plumageLoadedFor = useRef<string | null>(null);

    // True while waiting for the API to return a prediction
    const [loading, setLoading] = useState(false);

    // The full response object returned by POST /predict
    const [result, setResult] = useState<any | null>(null);

    // The species image fetched from /bird/{label}/image after a successful prediction
    const [birdImage, setBirdImage] = useState<string | null>(null);

    // Error message shown when the file type is invalid or the API returns an error field
    const [apiError, setApiError] = useState<string | null>(null);

    // Ref to the hidden file input so the drop zone click can open the browser file picker
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Called when the user picks a file — either by dropping or browsing
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

            const res = await fetch("http://127.0.0.1:8000/predict", {
                method: "POST",
                body: form,
            });
            data = await res.json();

            // If the API returned a top-level error field, show it and stop
            if (data.error) {
                setApiError(data.error);
                setLoading(false);
                return;
            }

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
                .then(res => {
                    if (!res.ok) throw new Error("Image fetch failed");
                    // The endpoint returns raw image binary data, not JSON
                    return res.blob();
                })
                .then(blob => {
                    setBirdImage(URL.createObjectURL(blob));
                })
                .catch(() => {
                    // Silently fail — the page still works without the image
                    console.error("Could not load species image for", label);
                });
        }
    }

    return (
        <main className="bg-[#FFFFFF]">

            {/* Section 1: Hero — page title and description */}
            <section className="bg-[#ffffff] px-8 py-14">
                <div className="max-w-3xl mx-auto text-center">
                    <h1 className="font-serif p-5 text-4xl font-bold text-[#333333] mb-15 underline">
                        Identify a Bird
                    </h1>
                    <p className="text-xl text-[#3F4850] leading-relaxed max-w-xl mx-auto">
                        Upload a photo and our model will identify the species from 525 possibilities.
                    </p>
                </div>
            </section>



            {/* Section 2: Upload — two-column layout with controls on the left and preview on the right */}
            <section className=" px-10 py-5 ">
                <div className="max-w-4xl mx-auto bg-[#ffd6b6] p-15 rounded-2xl">
                    <h2 className="font-serif text-3xl font-bold text-[#333333] mb-6">
                        Upload Your Photo
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

                        {/* Left column — upload button, file info, and help toggle */}
                        <div className="flex flex-col gap-5">

                            {/* Upload button — opens the hidden file picker */}
                            <div>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-6 py-3 rounded-xl bg-[#333333] text-white font-semibold text-xl hover:bg-[#3F4850] transition-colors w-full"
                                >
                                    Choose a Photo
                                </button>

                                {/* Hidden file input — triggered by the button above */}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/jpg,image/png,image/webp"
                                    className="hidden"
                                    onChange={handleInputChange}
                                />

                                {/* Show the selected file name once a file is chosen */}
                                {file && (
                                    <p className="mt-2 text-xs text-[#3F4850]/70 truncate">{file.name}</p>
                                )}
                            </div>

                            {/* File type information for the user */}
                            <div className="bg-white/60 rounded-xl px-4 py-3 text-base text-[#3F4850] leading-relaxed">
                                <p className="font-semibold text-[#333333] mb-1">Accepted file types</p>
                                <p>JPG, PNG, and WEBP images only. For best results, use a clear photo where the bird is the main subject and well-lit.</p>
                            </div>

                            {/* Help toggle — circular button that shows/hides step-by-step instructions */}
                            <div className="flex items-start gap-4">
                                <button
                                    onClick={() => setShowHelp(prev => !prev)}
                                    className="shrink-0 w-12 h-12 rounded-full bg-[#333333] text-white text-2xl font-bold hover:bg-[#3F4850] transition-colors flex items-center justify-center"
                                    aria-label="Toggle upload help"
                                >
                                    ?
                                </button>

                                {/* Step-by-step instructions — only shown when help is toggled on */}
                                {showHelp && (
                                    <div className="bg-white rounded-xl px-4 py-3 text-sm text-[#3F4850] shadow-sm">
                                        <p className="font-semibold text-[#333333] mb-2 text-base">How to upload</p>
                                        <ol className="flex flex-col gap-1 list-decimal list-inside">
                                            <li>Click <strong>Choose a Photo</strong> and select a bird image</li>
                                            <li>Check the preview on the right looks correct</li>
                                            <li>Click <strong>Identify Species</strong> to run the model</li>
                                            <li>Your results will appear below</li>
                                        </ol>
                                    </div>
                                )}
                            </div>

                            {/* Error message — shown for invalid file types or API errors */}
                            {apiError && (
                                <p className="text-sm text-red-600 font-medium">{apiError}</p>
                            )}

                            {/* Submit and clear controls — only shown once a file is chosen */}
                            {file && (
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={handleSubmit}
                                        disabled={loading}
                                        className="px-6 py-2.5 rounded-xl bg-[#ffbc88] text-[#333333] font-semibold text-sm hover:bg-[#ff9f5a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? "Identifying…" : "Identify Species"}
                                    </button>
                                    <button
                                        onClick={handleClear}
                                        className="text-sm text-[#3F4850]/60 underline hover:text-[#333333] transition-colors"
                                    >
                                        Clear
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Right column — image preview box */}
                        <div className="rounded-2xl bg-[#333333] min-h-[280px] flex items-center justify-center overflow-hidden">
                            {preview ? (
                                /* Uploaded image preview */
                                <img
                                    src={preview}
                                    alt="Uploaded bird photo preview"
                                    className="w-full h-full object-contain max-h-[320px]"
                                />
                            ) : (
                                /* Placeholder shown before any file is selected */
                                <div className="text-center px-6">
                                    <div className="text-4xl mb-3 opacity-30">🖼️</div>
                                    <p className="text-white/40 text-sm">Upload preview</p>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </section>

            <hr className="my-25 border-[#3F4850] border-5 mx-100" />

            {/* Section 3: Bird Summary — shown only after a confident prediction */}
            {result?.prediction?.accepted && (
                <section >
                    <div className="max-w-4xl mx-auto bg-[#fffdde] p-10">
                        <h2 className="font-serif text-3xl font-bold text-[#333333] mb-6 text-center">
                            Prediction Result
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">

                            {/* Left column — species image from the dataset */}
                            <div className="rounded-2xl overflow-hidden bg-[#C9C9C9] min-h-[260px] flex items-center justify-center">
                                {birdImage ? (
                                    <img
                                        src={birdImage}
                                        alt={toTitleCase(result.prediction.species_label)}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    /* Placeholder while the species image loads */
                                    <div className="w-full h-64 bg-[#C9C9C9] animate-pulse rounded-2xl" />
                                )}
                            </div>

                            {/* Right column — name, confidence, and top 5 list */}
                            <div className="flex flex-col gap-5">

                                {/* Predicted bird common name */}
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-[#3F4850]/50 mb-1">
                                        Identified Species
                                    </p>
                                    <h3 className="font-serif text-3xl font-bold text-[#333333]">
                                        {toTitleCase(result.prediction.species_label)}
                                    </h3>
                                </div>

                                {/* Model confidence score shown as a percentage badge */}
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-[#3F4850]/50 mb-1">
                                        Model Confidence
                                    </p>
                                    <span className="inline-block px-4 py-1.5 rounded-full bg-[#ffbc88] text-[#333333] font-bold text-lg">
                                        {(result.prediction.confidence * 100).toFixed(1)}%
                                    </span>
                                </div>

                                {/* Top 5 predictions — vertical list with name and confidence bar */}
                                {result.prediction.top_5_predictions?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-widest text-[#3F4850]/50 mb-3">
                                            Top 5 Predictions
                                        </p>
                                        <div className="flex flex-col gap-2">
                                            {result.prediction.top_5_predictions.map((item: any, i: number) => (
                                                <div key={i} className="flex flex-col gap-1">
                                                    <div className="flex items-center justify-between text-sm">
                                                        {/* Common name in Title Case */}
                                                        <span className={`font-medium ${i === 0 ? "text-[#333333]" : "text-[#3F4850]"}`}>
                                                            {toTitleCase(item.species_label)}
                                                        </span>
                                                        {/* Confidence percentage */}
                                                        <span className="text-[#3F4850]/70 font-mono text-xs">
                                                            {(item.confidence * 100).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                    {/* Visual confidence bar — top prediction is darker */}
                                                    <div className="w-full h-1.5 rounded-full bg-[#C9C9C9]/50">
                                                        <div
                                                            className={`h-1.5 rounded-full ${i === 0 ? "bg-[#333333]" : "bg-[#ffbc88]"}`}
                                                            style={{ width: `${(item.confidence * 100).toFixed(1)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Section 4: Bird Info Tabs — only shown after a confident prediction */}
            {result?.prediction?.accepted && (
                <section className="bg-[#FFFFFF] px-8 py-20">
                    <div className="max-w-4xl mx-auto">

                        {/* Tab button row — underline style, active tab has a dark bottom border */}
                        <div className="flex border-b border-[#C9C9C9] mb-8 gap-1">
                            {(["diet", "taxonomy", "history", "plumage", "migration"] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-5 py-2 text-lg font-semibold transition-colors border-b-3 -mb-px ${activeTab === tab
                                        ? "border-[#333333] text-[#333333]"
                                        : "border-transparent text-[#3F4850]/50 hover:text-[#333333]"
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

                        {/* Diet tab — prey items shown as a table with common name and class */}
                        {activeTab === "diet" && (() => {
                            const bird = result.bird;

                            // Pull prey names and classes, zipping them together by index
                            const names = cleanPreyList(bird?.diet?.prey_common_names ?? bird?.diet?.top_prey ?? []);
                            const classes: string[] = bird?.diet?.prey_classes ?? [];

                            return names.length > 0 ? (
                                <div className="overflow-x-auto rounded-xl border border-[#C9C9C9]">
                                    <table className="w-full text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-[#fffdde]">
                                                <th className="px-5 py-3 text-left text-lg font-semibold text-[#333333] border-b border-[#C9C9C9]">
                                                    Prey Common Name
                                                </th>
                                                <th className="px-5 py-3 text-left text-lg font-semibold text-[#333333] border-b border-[#C9C9C9]">
                                                    Prey Class
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {names.map((name, i) => (
                                                <tr
                                                    key={i}
                                                    className={i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}
                                                >
                                                    <td className="px-5 py-3 text-[#333333]">{name}</td>
                                                    <td className="px-5 py-3 text-[#3F4850]">
                                                        {/* Show the matching class if one exists, otherwise a dash */}
                                                        {classes[i] ?? "—"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-lg text-[#3F4850]/60 italic">
                                    No diet data available for this species.
                                </p>
                            );
                        })()}

                        {/* Family & Taxonomy tab — scientific classification of the predicted species */}
                        {activeTab === "taxonomy" && (() => {
                            const bird = result.bird;
                            const tax = bird?.taxonomy;

                            // Each row: display label, short definition, the field from taxonomy, and whether to highlight it
                            const rows = [
                                { label: "Class", definition: "The broadest grouping — all birds belong to the class Aves.", value: tax?.class, highlight: false },
                                { label: "Order", definition: "A group of related families that share common ancestry.", value: tax?.order, highlight: false },
                                { label: "Family", definition: "A group of closely related genera that share distinctive traits.", value: tax?.family, highlight: true },
                                { label: "Genus", definition: "A group of closely related species that share a common ancestor and many physical characteristics.", value: tax?.genus, highlight: true },
                            ];

                            return (
                                <div className="flex flex-col gap-6">

                                    {/* Scientific name displayed prominently above the table */}
                                    <div className="bg-[#fffdde] rounded-xl px-6 py-4 text-lg">
                                        <p className="text-base font-semibold uppercase tracking-widest text-[#3F4850]/50 mb-1">
                                            Scientific Name
                                        </p>
                                        <p className="font-serif text-2xl italic text-[#333333]">
                                            {bird?.scientific_name ?? "—"}
                                        </p>
                                        <p className="text-base text-[#3F4850]/60 mt-1">
                                            Common name: {toTitleCase(result.prediction.species_label)}
                                        </p>
                                    </div>

                                    {/* Taxonomy classification table */}
                                    <div className="overflow-x-auto rounded-xl border border-[#C9C9C9]">
                                        <table className="w-full text-sm border-collapse">
                                            <thead>
                                                <tr className="bg-[#fffdde]">
                                                    <th className="px-5 py-3 text-lg text-left font-semibold text-[#333333] border-b border-[#C9C9C9] w-1/3">
                                                        Rank
                                                    </th>
                                                    <th className="px-5 py-3 text-lg text-left font-semibold text-[#333333] border-b border-[#C9C9C9]">
                                                        Name
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rows.map((row, i) => (
                                                    <tr
                                                        key={i}
                                                        // Family and Genus rows are highlighted in yellow to draw attention
                                                        className={row.highlight ? "bg-[#fff99d]" : i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}
                                                    >
                                                        <td className="px-5 py-3">
                                                            <p className="font-semibold text-base text-[#333333]">{row.label}</p>
                                                            <p className="text-sm text-[#3F4850]/60 mt-0.5">{row.definition}</p>
                                                        </td>
                                                        <td className="px-5 text-lg py-3 text-[#3F4850]">
                                                            {row.value ?? "—"}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })()}
                        {/* History tab — Wikipedia content about the predicted species */}
                        {activeTab === "history" && (() => {
                            const bird = result.bird;
                            const extract: string = bird?.wikipedia?.extract ?? "";

                            // Split the extract into paragraphs so it reads naturally instead of one giant block
                            const paragraphs = extract
                                .split("\n")
                                .map((p: string) => p.trim())
                                .filter((p: string) => p.length > 0);

                            return (
                                <div className="flex flex-col gap-6">

                                    {/* Section header */}
                                    <div className="bg-[#fffdde] rounded-xl px-6 py-4">
                                        <p className="font-bold text-[#333333] text-2xl">
                                            {toTitleCase(result.prediction.species_label)}
                                        </p>
                                        <p className="text-base text-[#3F4850]/60 mt-0.5 italic">
                                            Wikipedia overview
                                        </p>
                                    </div>

                                    {/* Wikipedia extract rendered as separate paragraphs */}
                                    {paragraphs.length > 0 ? (
                                        <div className="flex flex-col gap-4">
                                            {paragraphs.map((para: string, i: number) => (
                                                <p key={i} className="text-base text-[#3F4850] leading-relaxed">
                                                    {para}
                                                </p>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-[#3F4850]/60 italic">
                                            No Wikipedia information available for this species.
                                        </p>
                                    )}
                                </div>
                            );
                        })()}
                        {/* Plumage tab — Wikimedia Commons photo gallery and Wikipedia description text */}
                        {activeTab === "plumage" && (() => {
                            const sections: Record<string, string> = result.bird?.wikipedia?.sections ?? {};

                            // Use the Description section first (covers appearance), fall back to Subspecies
                            const text = sections["Description"] ?? sections["Subspecies"] ?? null;

                            return (
                                <div className="flex flex-col gap-6">

                                    {/* Photo gallery — loading skeletons while images are being fetched */}
                                    {plumageLoading ? (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="h-48 bg-[#C9C9C9] animate-pulse rounded-xl" />
                                            <div className="h-48 bg-[#C9C9C9] animate-pulse rounded-xl" />
                                        </div>
                                    ) : plumageImages.length > 0 ? (
                                        /* 2-column grid of Wikimedia photos loaded from the backend cache */
                                        <div className="grid grid-cols-2 gap-4">
                                            {plumageImages.map((url, i) => (
                                                <img
                                                    key={i}
                                                    src={url}
                                                    alt={`Plumage photo ${i + 1}`}
                                                    className="w-full h-48 object-cover rounded-xl"
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-[#3F4850]/60 italic">
                                            No plumage images found for this species.
                                        </p>
                                    )}

                                    {/* Wikipedia description text */}
                                    {text ? (
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-widest text-[#3F4850]/50 mb-3">
                                                Description
                                            </p>
                                            <p className="text-sm text-[#3F4850] leading-relaxed">
                                                {text}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-[#3F4850]/60 italic">
                                            No plumage description available for this species.
                                        </p>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Migration tab — movement patterns, top sighting countries, and a Tableau map placeholder */}
                        {activeTab === "migration" && (() => {
                            const bird = result.bird;
                            const movement = bird?.conservation?.movement_patterns;
                            const topCountries: { country: string; count: number }[] = bird?.migration?.top_countries ?? [];
                            const totalSightings: number | null = bird?.migration?.total_sightings ?? null;

                            return (
                                <div className="flex flex-col gap-6">

                                    {/* Movement pattern card — explains how this species migrates */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="bg-[#fffdde] rounded-xl px-6 py-5">
                                            <p className="text-base font-semibold uppercase tracking-widest text-[#3F4850]/50 mb-1">
                                                Movement Pattern
                                            </p>
                                            <p className="font-bold text-[#333333] text-2xl">
                                                {movement ?? "—"}
                                            </p>
                                        </div>

                                        {/* Total sightings count */}
                                        <div className="bg-[#fffdde] rounded-xl px-6 py-5">
                                            <p className="text-base font-semibold uppercase tracking-widest text-[#3F4850]/50 mb-1">
                                                Total Recorded Sightings
                                            </p>
                                            <p className="font-bold text-[#333333] text-2xl">
                                                {totalSightings != null ? totalSightings.toLocaleString() : "—"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Top countries list — ranked by number of recorded sightings */}
                                    {topCountries.length > 0 && (
                                        <div className="rounded-xl border border-[#C9C9C9] overflow-hidden">
                                            <div className="bg-[#fffdde] px-5 py-3 border-b border-[#C9C9C9]">
                                                <p className="font-semibold text-[#333333] text-base">Top Sighting Countries</p>
                                            </div>
                                            <div className="divide-y divide-[#C9C9C9]">
                                                {topCountries.slice(0, 8).map((entry, i) => {
                                                    // Calculate each country's share of the total so we can draw a bar
                                                    const max = topCountries[0]?.count ?? 1;
                                                    const pct = Math.round((entry.count / max) * 100);
                                                    return (
                                                        <div key={i} className="px-5 py-3 flex items-center gap-4 bg-white">
                                                            {/* Rank number */}
                                                            <span className="text-base font-mono text-[#3F4850]/40 w-5 shrink-0">
                                                                {i + 1}
                                                            </span>
                                                            {/* Full country name looked up from the 2-letter code */}
                                                            <span className="text-sm text-[#333333] w-36 shrink-0">
                                                                {getCountryName(entry.country)}
                                                            </span>
                                                            {/* Relative sighting bar */}
                                                            <div className="flex-1 h-2 rounded-full bg-[#C9C9C9]/40">
                                                                <div
                                                                    className="h-2 rounded-full bg-[#ffbc88]"
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                            {/* Raw sighting count */}
                                                            <span className="text-xs font-mono text-[#3F4850]/60 w-16 text-right shrink-0">
                                                                {entry.count.toLocaleString()}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Individual Bird Occurrence — where this species has been spotted */}
                                    <div className="mt-4">
                                        <p className="text-white font-semibold mb-3">Occurrence Map</p>
                                        <TableauEmbed
                                            url={process.env.NEXT_PUBLIC_BIRD_OCCURRENCE!}
                                            title="Individual Bird Occurrence"
                                            height="500px"
                                            speciesFilter={result?.prediction?.species_label}
                                        />
                                    </div>

                                    {/* Monthly Sighting Over Time — when this species is typically spotted */}
                                    <div className="mt-8">
                                        <p className="text-white font-semibold mb-3">Monthly Sightings Over Time</p>
                                        <TableauEmbed
                                            url={process.env.NEXT_PUBLIC_MONTHLY_SIGHTING_OVERTIME!}
                                            title="Monthly Sighting Over Time"
                                            height="500px"
                                            speciesFilter={result?.prediction?.species_label}
                                        />
                                    </div>

                                    {/* Observation Trends by Year — whether sightings are increasing or decreasing */}
                                    <div className="mt-8">
                                        <p className="text-white font-semibold mb-3">Observation Trends by Year</p>
                                        <TableauEmbed
                                            url={process.env.NEXT_PUBLIC_OBSERVATION_BY_YEAR!}
                                            title="Observation Trends by Year"
                                            height="500px"
                                            speciesFilter={result?.prediction?.species_label}
                                        />
                                    </div>

                                </div>
                            );
                        })()}

                    </div>
                </section>
            )}

            {/* Section 5: What's Next — always visible call-to-action cards */}
            <section className="bg-[#fffdde] px-8 py-12">
                <div className="max-w-4xl mx-auto">
                    <h2 className="font-serif text-3xl font-bold text-[#333333] mb-2 text-center">
                        What would you like to do next?
                    </h2>
                    <p className="text-lg text-[#3F4850]/60 text-center mb-8">
                        Keep exploring — there are 525 species waiting to be discovered.
                    </p>

                    {/* Three action cards side by side */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-7">

                        {/* Card 1: Try another prediction */}
                        <div className="bg-white rounded-2xl p-6 flex flex-col items-center text-center gap-3 shadow-sm">
                            <div className="text-4xl">📷</div>
                            <h3 className="font-bold text-lg text-[#333333]">Try Another Photo</h3>
                            <p className="text-base text-[#3F4850]/70 leading-relaxed">
                                Upload a different image and see if the model can identify another species.
                            </p>
                            {/* Clicking this clears the result and scrolls back to the upload section */}
                            <button
                                onClick={() => {
                                    handleClear();
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className="mt-auto px-5 py-2 rounded-xl bg-[#333333] text-white text-xs font-semibold hover:bg-[#3F4850] transition-colors"
                            >
                                Upload a New Photo
                            </button>
                        </div>

                        {/* Card 2: Go to the Bird Explorer page */}
                        <div className="bg-white rounded-2xl p-6 flex flex-col items-center text-center gap-3 shadow-sm">
                            <div className="text-4xl">🔍</div>
                            <h3 className="font-bold text-lg text-[#333333]">Explore a Species</h3>
                            <p className="text-base text-[#3F4850]/70 leading-relaxed">
                                Search for any of the 525 species and dive deep into their full profile.
                            </p>
                            <Link
                                href="/bird"
                                className="mt-auto px-5 py-2 rounded-xl bg-[#ffbc88] text-[#333333] text-sm font-semibold hover:bg-[#ff9f5a] transition-colors"
                            >
                                Go to Bird Explorer
                            </Link>
                        </div>

                        {/* Card 3: Go to the Species Comparison page */}
                        <div className="bg-white rounded-2xl p-6 flex flex-col items-center text-center gap-3 shadow-sm">
                            <div className="text-4xl">⚖️</div>
                            <h3 className="font-bold text-lg text-[#333333]">Compare Species</h3>
                            <p className="text-base text-[#3F4850]/70 leading-relaxed">
                                Select up to 6 birds and compare their taxonomy, diet, and migration side by side.
                            </p>
                            <Link
                                href="/species"
                                className="mt-auto px-5 py-2 rounded-xl bg-[#ffbc88] text-[#333333] text-sm font-semibold hover:bg-[#ff9f5a] transition-colors"
                            >
                                Go to Species Comparison
                            </Link>
                        </div>

                    </div>
                </div>
            </section>

        </main>
    );
}
