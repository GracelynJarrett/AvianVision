"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
});

const API_BASE = "http://localhost:8000";

type Occurrence = {
    species_label: string;
    month: number;
    year: number;
};

export default function MonthlySightingsOverTime() {
    const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);
    const [selectedYears, setSelectedYears] = useState<number[]>([]);
    const species = Array.from(
        new Set(occurrences.map((item) => item.species_label))
    ).sort();

    const years = Array.from(
        new Set(occurrences.map((item) => item.year))
    ).sort((a, b) => a - b);
    useEffect(() => {
        fetch(`${API_BASE}/occurrences`)
            .then((res) => {
                if (!res.ok) {
                    throw new Error("Failed to fetch occurrences");
                }
                return res.json();
            })
            .then((data) => {
                console.log("First occurrence:", data.occurrences[0]);
                console.log("Available years:", [...new Set(data.occurrences.map((item: Occurrence) => item.year))]);

                setOccurrences(data.occurrences ?? []);
                setLoading(false);
            })
            .catch((error) => {
                console.error("Error fetching occurrences:", error);
                setLoading(false);
            });
    }, []);
    const filteredOccurrences = occurrences.filter((item) => {
        const matchesSpecies =
            selectedSpecies.length === 0 ||
            selectedSpecies.includes(item.species_label);

        const matchesYear =
            selectedYears.length === 0 ||
            selectedYears.includes(item.year);

        return matchesSpecies && matchesYear;
    });
    const chartData = Array.from(
        new Set(filteredOccurrences.map((item) => item.year))
    ).sort((a, b) => a - b).map((year) => {

        const yearlyOccurrences = filteredOccurrences.filter(
            (item) => item.year === year
        );

        const monthlyCounts = Array.from({ length: 12 }, (_, index) => {
            const month = index + 1;

            return yearlyOccurrences.filter(
                (item) => item.month === month
            ).length;
        });

        return {
            x: [
                "January", "February", "March", "April",
                "May", "June", "July", "August",
                "September", "October", "November", "December"
            ],
            y: monthlyCounts,
            type: "scatter" as const,
            mode: "lines+markers" as const,
            name: String(year),
        };
    });

    if (loading) {
        return <p>Loading occurrence data</p>
    }
    return (
        <div className="flex flex-col md:flex-row gap-5">

            {/* Graph */}
            <div className="flex-1 min-w-0">
                <Plot
                    data={chartData}
                    layout={{
                        title: { text: "Monthly Sightings Over Time" },
                        xaxis: {
                            title: { text: "Month" },
                        },
                        yaxis: {
                            title: { text: "Number of Sightings" },
                            rangemode: "tozero",
                        },
                        autosize: true,
                        margin: { t: 50, b: 60, l: 60, r: 20 },
                        legend: {
                            title: { text: "Year" },
                        },
                    }}
                    style={{ width: "100%", height: "500px" }}
                    useResizeHandler={true}
                />
            </div>

            {/* Species Filter */}
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
                    className="mt-3 rounded-lg bg-white/10 text-white px-3 py-2 w-full"
                >
                    Show All Birds
                </button>
            </div>
            {/* Year Filter */}
            <div className="md:w-56 shrink-0">
                <p className="text-white font-semibold mb-3">
                    Filter by Year
                </p>

                <select
                    multiple
                    value={selectedYears.map(String)}
                    onChange={(e) => {
                        const selected = Array.from(
                            e.target.selectedOptions,
                            (option) => Number(option.value)
                        );
                        setSelectedYears(selected);
                    }}
                    className="rounded-lg bg-white text-black p-2 w-full"
                    size={8}
                >
                    {years.map((year, index) => (
                        <option key={`${year}-${index}`} value={year}>
                            {year}
                        </option>
                    ))}
                </select>

                <button
                    onClick={() => setSelectedYears([])}
                    className="mt-3 rounded-lg bg-white/10 text-white px-3 py-2 w-full"
                >
                    Show All Years
                </button>
            </div>



        </div>
    );
}





