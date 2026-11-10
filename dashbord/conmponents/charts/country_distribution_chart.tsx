"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
});

const API_BASE = "http://localhost:8000";

type Occurrence = {
    country: string;
    species_label: string;
    occurrence_count: number;
};

export default function CountryDistribution() {
    const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);
    const [topN, setTopN] = useState("All");

    const species = Array.from(
        new Set(occurrences.map((item) => item.species_label))
    ).sort();

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

    const filteredOccurrences =
        selectedSpecies.length === 0
            ? occurrences
            : occurrences.filter((item) =>
                selectedSpecies.includes(item.species_label)
            );
    const countryCounts = Object.values(
        filteredOccurrences.reduce((acc, item) => {
            if (!acc[item.country]) {
                acc[item.country] = {
                    country: item.country,
                    count: 0,
                };
            }

            acc[item.country].count += item.occurrence_count;

            return acc;
        }, {} as Record<string, { country: string; count: number }>)
    ).sort((a, b) => b.count - a.count);

    const displayedCountries =
        topN === "All"
            ? countryCounts
            : countryCounts.slice(0, Number(topN));




    const chartData = [
        {
            x: displayedCountries.map((item) => item.count),
            y: displayedCountries.map((item) => item.country),
            type: "bar" as const,
            orientation: "h" as const,
            marker: {
                color: displayedCountries.map((item) => item.count),
                colorscale: "YlorRd",
                showscale: true,
                colorbar: {
                    title: { text: "Sightings" },
                },
            },
            text: displayedCountries.map((item) => item.count.toLocaleString()),
            textposition: "outside" as const,
            hovertemplate:
                "<b>%{y}</b><br>Sightings: %{x:,}<extra></extra>",
        },
    ];
    if (loading) {
        return <p>Loading occurrence data...</p>;
    }
    return (
        <div className="flex flex-col md:flex-row gap-5">

            {/* Graph */}

            <div className="mb-4">
                <label className="font-semibold mr-2">Show Countries:</label>
                <select
                    value={topN}
                    onChange={(e) => setTopN(e.target.value)}
                    className="rounded-lg bg-white text-black p-2"
                >
                    <option value="5">Top 5</option>
                    <option value="10">Top 10</option>
                    <option value="15">Top 15</option>
                    <option value="20">Top 20</option>
                    <option value="All">All</option>
                </select>
            </div>
            <div className="flex-1 min-w-0">
                <Plot
                    data={chartData}
                    layout={{
                        title: { text: "Country Distribution" },
                        xaxis: {
                            title: { text: "Number of Sightings" },
                        },
                        yaxis: {
                            title: { text: "Country" },
                            automargin: true,
                        },
                        autosize: true,
                        margin: { t: 50, b: 60, l: 120, r: 80 },
                    }}
                    style={{ width: "100%", height: "700px" }}
                    useResizeHandler={true}
                />
            </div>
            {/* Species Filter */}
            <div className="md:w-56 shrink-0">
                <p className="font-semibold mb-3">Filter by Bird Label</p>

                <select
                    multiple
                    value={selectedSpecies}
                    onChange={(e) => {
                        const selected = Array.from(
                            e.target.selectedOptions,
                            (option) => option.value
                        );
                        setSelectedSpecies(selected);
                    }}
                    className="rounded-lg bg-white text-black p-2 w-full"
                    size={12}
                >
                    {species.map((label) => (
                        <option key={label} value={label}>
                            {label}
                        </option>
                    ))}
                </select>

                <button
                    onClick={() => setSelectedSpecies([])}
                    className="mt-3 rounded-lg bg-white text-black px-4 py-2 w-full"
                >
                    Show All Birds
                </button>
            </div>


        </div>
    );
}







