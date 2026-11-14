"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
});

const API_BASE = "http://localhost:8000";

type Occurrence = {
    year: number;
    species_label: string;
    occurrence_count: number;
};

export default function ObservationTrendsByYear() {

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

    const chartSpecies = Array.from(
        new Set(filteredOccurrences.map((item) => item.species_label))
    ).sort();

    const chartData = chartSpecies.map((label) => {
        const yearlyData = Array.from(
            new Set(filteredOccurrences.map((item) => item.year))
        ).sort((a, b) => a - b);

        return {
            x: yearlyData,
            y: yearlyData.map((year) =>
                filteredOccurrences
                    .filter(
                        (item) =>
                            item.year === year &&
                            item.species_label === label
                    )
                    .reduce((sum, item) => sum + item.occurrence_count, 0)
            ),
            name: label,
            type: "bar" as const,
            textposition: "inside" as const,
        };
    });

    if (loading) {
        return <p>Loading occurrence data...</p>;
    }

    return (
        <div className="flex flex-col md:flex-row gap-5">
            <div className="flex-1 min-w-0">
                <Plot
                    data={chartData}
                    layout={{
                        title: { text: "Observation Trends by Year" },
                        barmode: "stack",
                        xaxis: {
                            title: { text: "Year" },
                            type: "category",
                        },
                        yaxis: {
                            title: { text: "Number of Occurrences" },
                        },
                        autosize: true,
                        margin: { t: 50, b: 60, l: 80, r: 40 },
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
