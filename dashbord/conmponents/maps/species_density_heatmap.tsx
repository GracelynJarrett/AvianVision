"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
});

const API_BASE = "http://localhost:8000";

type Occurrence = {
    avg_lon: number;
    avg_lat: number;
    species_label: string;
    scientific_name: string;
    occurrence_count: number;
};

export default function SpeciesDensityHeatmap() {
    const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);
    useEffect(() => {
        fetch(`${API_BASE}/occurrences`)
            .then((res) => res.json())
            .then((data) => {
                setOccurrences(data.occurrences ?? []);
                setLoading(false);
            })
            .catch((error) => {
                console.error("Error fetching occurrences:", error);
                setLoading(false);
            });
    }, []);
    const species = Array.from(
        new Set(occurrences.map((item) => item.species_label))
    ).sort();

    const filteredOccurrences =
        selectedSpecies.length === 0
            ? occurrences
            : occurrences.filter((item) =>
                selectedSpecies.includes(item.species_label)
            );

    const chartData = [
        {
            type: "densitymap" as const,
            lon: filteredOccurrences.map((item) => item.avg_lon),
            lat: filteredOccurrences.map((item) => item.avg_lat),
            z: filteredOccurrences.map((item) => item.occurrence_count),
            radius: 15,
            colorscale: "YlOrRd",
            colorbar: {
                title: { text: "Sightings" },
            },
        },
    ];

    if (loading) {
        return <p>Loading occurrence data...</p>;
    }
    return (
        <div className="flex flex-col md:flex-row gap-5">
            <div className="flex-1 min-w-0">
                <Plot
                    data={chartData}
                    layout={{
                        title: { text: "Species Density Heatmap" },
                        xaxis: {
                            title: { text: "Average Longitude" },
                        },
                        yaxis: {
                            title: { text: "Average Latitude" },
                        },
                        autosize: true,
                        margin: { t: 50, b: 60, l: 70, r: 80 },
                        map: {
                            style: "open-street-map",
                            center: { lon: 0, lat: 20 },
                            zoom: 1.5,
                        },
                    }}
                    style={{ width: "100%", height: "850px" }}
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
