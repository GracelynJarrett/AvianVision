"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
});

const API_BASE = "http://localhost:8000";

type Occurrence = {
    avg_lat: number;
    avg_lon: number;
    occurrence_count: number;
    species_label: string;
    country: string;
    scientific_name: string;
    month: number;
};

const speciesColors = [
    "#38bdf8",
    "#f97316",
    "#a78bfa",
    "#22c55e",
    "#f43f5e",
    "#eab308",
    "#14b8a6",
    "#ec4899",
    "#6366f1",
    "#84cc16",
];



export default function AllBirdOccurrenceMap_birdType() {
    const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);;
    const species = Array.from(
        new Set(occurrences.map((item) => item.species_label))
    ).sort();

    const filteredOccurrences =
        selectedSpecies.length === 0
            ? occurrences
            : occurrences.filter((item) =>
                selectedSpecies.includes(item.species_label)
            );

    useEffect(() => {
        fetch(`${API_BASE}/occurrences`)
            .then((res) => {
                if (!res.ok) {
                    throw new Error("Failed to fetch occurrences");
                }
                return res.json();
            })
            .then((data) => {
                setOccurrences(data.occurrences ?? []);
                setLoading(false);
            })
            .catch((error) => {
                console.error("Error fetching occurrences:", error);
                setLoading(false);
            });
    }, []);


    if (loading) {
        return <p>Loading occurrence data...</p>;
    }

    return (
        <div className="flex flex-col md:flex-row gap-5">

            {/* Map */}
            <div className="flex-1 min-w-0">
                <Plot
                    data={Array.from(new Set(filteredOccurrences.map((item) => item.species_label))).map(
                        (speciesLabel, index) => {
                            const speciesOccurrences = filteredOccurrences.filter(
                                (item) => item.species_label === speciesLabel
                            );

                            return {
                                type: "scattergeo" as const,
                                mode: "markers" as const,
                                name: speciesLabel,
                                showlegend: false,
                                lat: speciesOccurrences.map((item) => item.avg_lat),
                                lon: speciesOccurrences.map((item) => item.avg_lon),
                                marker: {
                                    size: 5,
                                    color: speciesColors[index % speciesColors.length],
                                    opacity: 0.6,
                                },
                            };
                        }
                    )}
                    layout={{
                        title: { text: "All Bird Occurrence" },
                        geo: {
                            projection: { type: "natural earth" },
                            showland: true,
                            landcolor: "#eeeeee",
                            showcountries: true,
                        },
                        autosize: true,
                        margin: { t: 50, b: 20, l: 20, r: 20 },
                    }}
                    style={{ width: "100%", height: "600px" }}
                    useResizeHandler={true}
                />
            </div>

            {/* Bird Filter */}
            <div className="md:w-56 shrink-0">
                <p className="text-white font-semibold mb-3">
                    Filter by Bird Label
                </p>

                <select
                    multiple
                    value={selectedSpecies}
                    onChange={(e) => {
                        const selected = Array.from(
                            e.target.selectedOptions,
                            (option) => option.value
                        );

                        if (selected.includes("All")) {
                            setSelectedSpecies([]);
                        } else {
                            setSelectedSpecies(selected);
                        }
                    }}
                    className="rounded-lg bg-white text-black p-2 w-full"
                    size={12}
                >
                    <option value="All">All Countries</option>
                    {species.map((label) => (
                        <option key={label} value={label}>
                            {label}
                        </option>
                    ))}
                </select>

                <button
                    onClick={() => setSelectedSpecies([])}
                    className="mt-3 rounded-lg bg-white/10 text-white px-3 py-2 w-full"
                >
                    Show All Countries
                </button>
            </div>

        </div>
    );
}


















