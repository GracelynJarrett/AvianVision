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

const countryColors = [
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



export default function AllBirdOccurrenceMap() {
    const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
    const countries = Array.from(
        new Set(occurrences.map((item) => item.country))
    ).sort();

    const filteredOccurrences =
        selectedCountries.length === 0
            ? occurrences
            : occurrences.filter((item) =>
                selectedCountries.includes(item.country)
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
                    data={Array.from(new Set(filteredOccurrences.map((item) => item.country))).map(
                        (country, index) => {
                            const countryOccurrences = filteredOccurrences.filter(
                                (item) => item.country === country
                            );

                            return {
                                type: "scattergeo" as const,
                                mode: "markers" as const,
                                name: country,
                                showlegend: false,
                                lat: countryOccurrences.map((item) => item.avg_lat),
                                lon: countryOccurrences.map((item) => item.avg_lon),
                                marker: {
                                    size: 5,
                                    color: countryColors[index % countryColors.length],
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

            {/* Country Filter */}
            <div className="md:w-56 shrink-0">
                <p className="text-white font-semibold mb-3">
                    Filter by Country
                </p>

                <select
                    multiple
                    value={selectedCountries}
                    onChange={(e) => {
                        const selected = Array.from(
                            e.target.selectedOptions,
                            (option) => option.value
                        );

                        if (selected.includes("All")) {
                            setSelectedCountries([]);
                        } else {
                            setSelectedCountries(selected);
                        }
                    }}
                    className="rounded-lg bg-white text-black p-2 w-full"
                    size={12}
                >
                    <option value="All">All Countries</option>
                    {countries.map((country) => (
                        <option key={country} value={country}>
                            {country}
                        </option>
                    ))}
                </select>

                <button
                    onClick={() => setSelectedCountries([])}
                    className="mt-3 rounded-lg bg-white/10 text-white px-3 py-2 w-full"
                >
                    Show All Countries
                </button>
            </div>

        </div>
    );
}


















