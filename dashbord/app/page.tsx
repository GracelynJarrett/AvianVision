"use client";
import { useEffect, useState } from "react";
import BirdSlideshow from "@/conmponents/birdslideshow";
import Link from "next/link";

// The three cards that explain what AvianVision is and why it exists
const projectSections = [
  { title: "Why", description: "Make bird species identification more accessible through artificial intelligence." },
  { title: "How", description: "Use a trained AI model to predict bird species from images." },
  { title: "What", description: "Explore bird identification, species information, and project data." },
];

// The four navigation cards that link to the main sections of the app
const exploreLinks = [
  { href: "/predict", title: "Prediction", description: "Identify a bird species using an AI-powered image prediction." },
  { href: "/bird",    title: "Bird",        description: "Look up information about an individual bird species." },
  { href: "/species", title: "Species",     description: "Compare different bird species side by side." },
  { href: "/stats",   title: "Model Metrics", description: "Explore the performance of the AvianVision AI model." },
];

export default function Home() {
  const [speciesCount,     setSpeciesCount]     = useState<number | null>(null);
  const [countryCount,     setCountryCount]     = useState<number | null>(null);
  const [yearRange,        setYearRange]        = useState<{ min: number | null; max: number | null } | null>(null);
  const [accuracy,         setAccuracy]         = useState<number | null>(null);
  const [f1Score,          setF1Score]          = useState<number | null>(null);
  const [loss,             setLoss]             = useState<number | null>(null);
  const [predictionCount,  setPredictionCount]  = useState<number | null>(null);

  // Fetch dashboard statistics from the API when the page first loads
  useEffect(() => {
    fetch("http://127.0.0.1:8000/home")
      .then((r) => r.json())
      .then((data) => {
        setSpeciesCount(data.dataset.species_count);
        setCountryCount(data.coverage.country_count);
        setYearRange(data.coverage.year_range);
        setAccuracy(data.model.accuracy);
        setF1Score(data.model.f1_score);
        setLoss(data.model.loss);
        setPredictionCount(data.predictions.total_predictions);
      })
      .catch((err) => console.error("Error fetching home statistics:", err));
  }, []);

  return (
    <main className="flex-1 min-w-0 bg-[#f8f9f9]">

      {/* Featured bird slideshow — full-width banner at the top of the content area */}
      <BirdSlideshow />

      <div className="p-6 flex flex-col gap-5 max-w-[1100px]">

        {/* Welcome card — project tagline and quick-access buttons */}
        <section className="bg-white border border-[#e3e6e8] rounded-lg p-6 shadow-sm">
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="px-2 py-0.5 bg-[#f1f2f3] text-[#6a737c] text-xs font-medium rounded">AI identification</span>
            <span className="px-2 py-0.5 bg-[#f1f2f3] text-[#6a737c] text-xs font-medium rounded">525 species</span>
          </div>
          <h1 className="text-2xl font-bold text-[#232629] mb-2 leading-tight">Welcome to AvianVision!</h1>
          <p className="text-sm text-[#6a737c] leading-relaxed max-w-[460px] mb-4">
            Discover bird species through AI-powered image identification and explore the data behind the project.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/predict"
              className="px-4 py-2 bg-[#ffbc88] text-[#232629] font-semibold text-sm rounded hover:bg-[#ff9f5a] transition-colors"
            >
              Identify a bird
            </Link>
            <Link
              href="/bird"
              className="px-4 py-2 bg-white border border-[#d6d9dc] text-[#232629] font-semibold text-sm rounded hover:bg-[#f8f9f9] transition-colors"
            >
              Browse species
            </Link>
          </div>
        </section>

        {/* Stat cards — four live numbers from the API */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Dataset",      value: speciesCount ?? "—",                                     sub: "Species" },
            { label: "Coverage",     value: countryCount ?? "—",                                     sub: "Countries represented" },
            { label: "Observations", value: `${yearRange?.min ?? "—"} – ${yearRange?.max ?? "—"}`,   sub: "Year range" },
            { label: "Predictions",  value: predictionCount ?? "—",                                  sub: "Total predictions made" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-white border border-[#e3e6e8] border-t-[3px] border-t-blue-500 rounded-lg p-4">
              <div className="text-[11px] text-[#9199a1] uppercase tracking-widest mb-1">{label}</div>
              <div className="text-2xl font-bold text-[#232629] tabular-nums">{String(value)}</div>
              <div className="text-sm text-[#6a737c] mt-0.5">{sub}</div>
            </div>
          ))}
        </div>

        {/* AI Model Performance + About the project — two cards side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Model performance card — bar chart for accuracy, F1, and loss */}
          <div className="bg-white border border-[#e3e6e8] rounded-lg p-5">
            <div className="flex justify-between items-baseline mb-4">
              <span className="font-semibold text-sm text-[#232629]">AI Model Performance</span>
              <Link href="/stats" className="text-xs text-blue-600 hover:text-blue-700">Model metrics →</Link>
            </div>
            {[
              { label: "Accuracy", value: accuracy  !== null ? `${(accuracy  * 100).toFixed(2)}%` : "—", pct: (accuracy  ?? 0) * 100, color: "bg-green-500" },
              { label: "F1 Score", value: f1Score   !== null ? `${(f1Score   * 100).toFixed(2)}%` : "—", pct: (f1Score   ?? 0) * 100, color: "bg-blue-500"  },
              { label: "Loss",     value: loss       !== null ? loss.toFixed(4)                   : "—", pct: (loss      ?? 0) * 100, color: "bg-[#ffbc88]" },
            ].map(({ label, value, pct, color }) => (
              <div key={label} className="flex items-center gap-4 mb-3">
                <span className="w-16 text-sm text-[#6a737c]">{label}</span>
                {/* Bar width is capped at 100% to prevent overflow on the loss value */}
                <div className="flex-1 h-2.5 bg-[#e3e6e8] rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <span className="w-16 text-right text-sm font-semibold text-[#232629]">{value}</span>
              </div>
            ))}
          </div>

          {/* About the project card — Why / How / What */}
          <div className="bg-white border border-[#e3e6e8] rounded-lg p-5">
            <span className="font-semibold text-sm text-[#232629] block mb-4">About the project</span>
            {projectSections.map(({ title, description }) => (
              <div key={title} className="flex gap-3 text-sm leading-relaxed mb-3">
                <span className="w-10 flex-none font-semibold text-[#ff9f5a]">{title}</span>
                <span className="text-[#6a737c]">{description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Explore AvianVision — navigation cards linking to the four main pages */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {exploreLinks.map(({ href, title, description }) => (
            <Link
              key={href}
              href={href}
              className="bg-white border border-[#e3e6e8] rounded-lg p-4 flex flex-col gap-1.5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
            >
              <span className="font-semibold text-sm text-blue-600">{title} →</span>
              <span className="text-xs leading-relaxed text-[#6a737c]">{description}</span>
            </Link>
          ))}
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
