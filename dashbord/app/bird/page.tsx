"use client";
import { useEffect, useState } from "react";

// The bird that is shown when the page first loads
const DEFAULT_BIRD = "EUROPEAN TURTLE DOVE";

// Maps IUCN conservation status codes to a display color using the site palette
// Severity runs from dark (most serious) to light (least serious)
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

export default function BirdPage() {
    const [birdNames, setBirdNames] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState(DEFAULT_BIRD);
    const [selectedBird, setSelectedBird] = useState(DEFAULT_BIRD);
    const [birdData, setBirdData] = useState<any>(null);
    const [birdDataLoading, setBirdDataLoading] = useState(true);
    const [birdImage, setBirdImage] = useState<string | null>(null);

    // Load the full list of 525 bird species names from the CSV when the page first opens
    useEffect(() => {
        fetch("/bird_name_mapping.csv")
            .then(response => response.text())
            .then(data => {
                const names = data
                    .split("\n")
                    .slice(1)
                    .map(row => row.split(",")[0].trim())
                    .filter(name => name.length > 0);
                setBirdNames(names);
            })
            .catch(error => console.error("Error loading bird names:", error));
    }, []);

    // Fetch the bird's enrichment data from the API whenever the selected bird changes
    useEffect(() => {
        setBirdDataLoading(true);
        setBirdData(null);
        fetch(`http://127.0.0.1:8000/bird/${encodeURIComponent(selectedBird)}`)
            .then(response => {
                if (!response.ok) throw new Error("Failed to fetch bird information");
                return response.json();
            })
            .then(data => {
                setBirdData(data.bird);
                setBirdDataLoading(false);
            })
            .catch(error => {
                console.error("Error loading bird information:", error);
                setBirdDataLoading(false);
            });
    }, [selectedBird]);

    // Fetch the bird's image from the API whenever the selected bird changes
    useEffect(() => {
        setBirdImage(null);
        fetch(`http://127.0.0.1:8000/bird/${encodeURIComponent(selectedBird)}/image`)
            .then(response => {
                if (!response.ok) throw new Error("Failed to fetch bird image");
                return response.blob();
            })
            .then(blob => setBirdImage(URL.createObjectURL(blob)))
            .catch(error => console.error("Error loading bird image:", error));
    }, [selectedBird]);

    // Called when the user types in the search box — updates the input and loads the bird
    // if what they typed exactly matches a name in the list (happens when they pick from the dropdown)
    function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.target.value.toUpperCase();
        setSearchQuery(value);
        if (birdNames.includes(value)) {
            setSelectedBird(value);
        }
    }

    // Pick a completely random bird from the loaded name list and display it
    function handleRandom() {
        if (birdNames.length === 0) return;
        const randomName = birdNames[Math.floor(Math.random() * birdNames.length)];
        setSearchQuery(randomName);
        setSelectedBird(randomName);
    }

    return (
        <main className="bg-[#FFFFFF] text-[#3F4850]">

            {/* ── Page description ────────────────────────────────────────────────── */}
            {/* Explains what this page is for before the user starts exploring */}
            <section className="px-8 pt-12 pb-10 max-w-4xl mx-auto">
                <h1 className="text-2xl font-serif font-bold text-center pb-6 text-[#333333]">
                    About This Page
                </h1>
                <p className="text-lg pb-4 leading-relaxed">
                    Explore information about different bird species, including
                    their population status, family relationships, descriptions,
                    and migration patterns. Search for a specific species or use
                    the random button to discover something new.
                </p>
                <p className="text-lg leading-relaxed">
                    This page was developed as part of an AI-powered bird
                    identification project designed to help researchers identify
                    and explore different bird species.
                </p>
            </section>

            {/* ── Section 1: Search ───────────────────────────────────────────────── */}
            {/* Lets the user find a bird by typing or load a random one */}
            <section className="bg-[#ffd6b6] px-8 py-10">
                <div className="max-w-2xl mx-auto">
                    <h2 className="font-serif text-xl font-semibold text-center mb-6 text-[#333333]">
                        Find a Bird
                    </h2>

                    <div className="flex flex-col gap-4">

                        {/* Text input — type to filter; picking from the dropdown list loads that bird */}
                        <div className="flex flex-col gap-1">
                            <label htmlFor="bird-search" className="text-sm font-medium text-[#3F4850]">
                                Search by name
                            </label>
                            <input
                                id="bird-search"
                                type="text"
                                list="bird-name-list"
                                value={searchQuery}
                                onChange={handleSearchChange}
                                placeholder="Type a bird name..."
                                className="w-full rounded-lg border border-[#3F4850]/30 bg-white px-4 py-3 text-[#333333] placeholder:text-[#909090] focus:outline-none focus:ring-2 focus:ring-[#3F4850]/40"
                            />
                            {/* datalist feeds the browser's native dropdown suggestions */}
                            <datalist id="bird-name-list">
                                {birdNames.map(name => (
                                    <option key={name} value={name} />
                                ))}
                            </datalist>
                        </div>

                        {/* Random button — picks a surprise bird from the full 525-species list */}
                        <div className="flex justify-center">
                            <button
                                onClick={handleRandom}
                                disabled={birdNames.length === 0}
                                className="rounded-lg bg-[#3F4850] px-8 py-3 text-white font-medium hover:bg-[#333333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Random Bird
                            </button>
                        </div>

                        {/* Shows which bird is currently loaded */}
                        {selectedBird && (
                            <p className="text-center text-sm text-[#3F4850]">
                                Currently showing:{" "}
                                <span className="font-semibold">{selectedBird}</span>
                            </p>
                        )}
                    </div>
                </div>
            </section>

            {/* ── Section 2: Bird Header ──────────────────────────────────────────── */}
            {/* Shows the bird's image on the left and key facts on the right */}
            <section className="px-8 py-12">
                <div className="max-w-5xl mx-auto flex flex-col gap-10 md:flex-row md:items-start md:gap-12">

                    {/* Bird image — shows a placeholder box while the image is loading */}
                    <div className="flex-shrink-0 flex justify-center">
                        <div className="w-72 h-72 rounded-2xl border-2 border-[#C9C9C9] bg-[#fffdde] overflow-hidden flex items-center justify-center">
                            {birdImage ? (
                                <img
                                    src={birdImage}
                                    alt={selectedBird}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                // Shown while the image fetch is in flight
                                <p className="text-[#909090] text-sm">Loading image...</p>
                            )}
                        </div>
                    </div>

                    {/* Bird information — name, scientific name, and conservation details */}
                    <div className="flex flex-col gap-4 flex-1">

                        {birdDataLoading ? (
                            // Shown while the API call is in flight
                            <p className="text-[#909090]">Loading bird information...</p>
                        ) : birdData ? (
                            <>
                                {/* Common name */}
                                <h2 className="font-serif text-4xl font-bold text-[#333333] leading-tight">
                                    {birdData.species_label}
                                </h2>

                                {/* Scientific name */}
                                <p className="italic text-xl text-[#909090]">
                                    {birdData.scientific_name}
                                </p>

                                {/* Divider */}
                                <hr className="border-[#C9C9C9]" />

                                {/* Conservation status badge */}
                                <div className="flex flex-wrap gap-3 items-center">
                                    <span className="text-sm font-medium text-[#3F4850]">
                                        Conservation Status:
                                    </span>
                                    <span className={`rounded-full px-4 py-1 text-sm font-semibold ${getStatusColor(birdData.conservation?.status_label)}`}>
                                        {birdData.conservation?.status_label ?? "Unknown"}
                                    </span>
                                </div>

                                {/* Population trend */}
                                {birdData.conservation?.population_trend && (
                                    <div className="flex gap-3 items-center">
                                        <span className="text-sm font-medium text-[#3F4850]">
                                            Population Trend:
                                        </span>
                                        <span className="text-sm text-[#333333]">
                                            {birdData.conservation.population_trend}
                                        </span>
                                    </div>
                                )}

                                {/* Movement patterns */}
                                {birdData.conservation?.movement_patterns && (
                                    <div className="flex gap-3 items-center">
                                        <span className="text-sm font-medium text-[#3F4850]">
                                            Movement:
                                        </span>
                                        <span className="text-sm text-[#333333]">
                                            {birdData.conservation.movement_patterns}
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : (
                            // Shown if the API returned no data for this bird
                            <p className="text-[#909090]">No information available for this species.</p>
                        )}
                    </div>
                </div>
            </section>

        </main>
    );
}
