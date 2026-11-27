"use client";
import { useEffect, useState } from "react";

// Renders a metric formula as a visual fraction if numerator/denominator are provided,
// or as plain styled text if the metric only has a formula string
function FormulaCell({ m }: { m: any }) {
    if (m.numerator && m.denominator) {
        return (
            <div className="inline-flex flex-col items-center gap-1 font-mono text-xs text-[#6a737c]">
                {/* Numerator sits above the dividing line */}
                <span className="text-center">{m.numerator}</span>
                {/* The horizontal dividing line */}
                <span className="w-full border-t border-[#babfc4]" />
                {/* Denominator sits below the dividing line */}
                <span className="text-center">{m.denominator}</span>
            </div>
        );
    }
    return (
        <span className="font-mono text-xs text-[#6a737c] bg-[#f8f9f9] rounded px-2 py-1 inline-block">
            {m.formula ?? "—"}
        </span>
    );
}

// The five training stages shown in the stage selector
const STAGES = [
    { id: 1, label: "Dataset" },
    { id: 2, label: "Architecture" },
    { id: 3, label: "Data Augmentation" },
    { id: 4, label: "Hyperparameter Tuning" },
    { id: 5, label: "Final Evaluation" },
] as const;

// The two models the toggle at the top can switch between
const MODELS = [
    { id: "classifier", label: "Species Classifier" },
    { id: "gate", label: "Bird Gate" },
] as const;

// The stats page shows how the AvianVision AI model was trained and how well it performs
export default function StatsPage() {

    const [statsData, setStatsData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Which training stage is currently shown — stage 1 (Dataset) is the starting point
    const [stage, setStage] = useState(1);

    // Which model the page is showing — the species classifier is the starting point
    const [model, setModel] = useState<"classifier" | "gate">("classifier");
    const isGate = model === "gate";

    // The MLflow runs for the model picked in the toggle.
    // The API sends the classifier runs under "mlflow" and the bird gate runs under "gate_mlflow",
    // and both have the same layout, so the rest of the page can read either one the same way.
    const ml = isGate ? statsData?.gate_mlflow : statsData?.mlflow;

    // Fetch all stats data from the API when the page first loads
    useEffect(() => {
        fetch("http://127.0.0.1:8000/stats")
            .then((res) => res.json())
            .then((data) => { setStatsData(data); setLoading(false); })
            .catch(() => { setError("Could not load stats. Make sure the API is running."); setLoading(false); });
    }, []);

    // best_model has the final test metrics; best_hyperparameter_model carries the train/val breakdown
    const best = ml?.best_model;
    const bestHT = ml?.best_hyperparameter_model;
    const bestTest = best?.test;
    const bestVal = bestHT?.validation;
    const bestTrain = bestHT?.train;

    // Format a 0–1 decimal as a percentage string, or "—" if the value is missing
    function fmtPct(val: number | null | undefined): string {
        if (val == null) return "—";
        return (val * 100).toFixed(2) + "%";
    }

    // Format a loss value to 4 decimal places, or "—" if missing
    function fmtLoss(val: number | null | undefined): string {
        if (val == null) return "—";
        return val.toFixed(4);
    }

    return (
        <main className="flex-1 min-w-0 bg-[#f8f9f9] flex flex-col">

            {/* ── Dark accuracy hero — always visible at the top ─────────────── */}
            <div className="bg-[#232629] px-6 py-8" style={{ borderTop: "3px solid #ffbc88" }}>
                {/* Title on the left, model toggle on the right */}
                <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-xl font-bold text-white mb-0.5">Model Performance</h1>
                        <p className="text-base text-[#9199a1]">
                            {isGate
                                ? "AvianVision Bird Gate EfficientNetB0 — bird / not-bird filter"
                                : "AvianVision EfficientNetB0 — 525 bird species"}
                        </p>
                    </div>

                    {/* Model toggle — switches every card and stage below between the two models */}
                    <div className="inline-flex rounded-lg bg-white/10 p-1">
                        {MODELS.map(m => (
                            <button
                                key={m.id}
                                onClick={() => setModel(m.id)}
                                className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors whitespace-nowrap ${model === m.id
                                    ? "bg-[#ffbc88] text-[#232629]"
                                    : "text-[#9199a1] hover:text-white"
                                    }`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading && <p className="text-[#9199a1] text-sm">Loading stats…</p>}
                {error && <p className="text-[#ffbc88] text-sm">{error}</p>}

                {!loading && !error && (
                    <div className="flex flex-wrap gap-4">
                        {/* Three primary test metric cards */}
                        {[
                            { label: "Test Accuracy", value: fmtPct(bestTest?.accuracy) },
                            { label: "Test F1 Score", value: fmtPct(bestTest?.f1_score) },
                            { label: "Test Loss", value: fmtLoss(bestTest?.loss) },
                        ].map(({ label, value }) => (
                            <div key={label} className="bg-white/10 rounded-lg px-6 py-4 text-center min-w-[140px]">
                                <p className="text-sm text-[#9199a1] mb-1">{label}</p>
                                <p className="text-3xl font-bold text-white">{value}</p>
                            </div>
                        ))}

                        {/* Four secondary train/val metric cards */}
                        {[
                            { label: "Train Accuracy", value: fmtPct(bestTrain?.accuracy) },
                            { label: "Val Accuracy", value: fmtPct(bestVal?.accuracy) },
                            { label: "Val Precision", value: fmtPct(bestVal?.precision) },
                            { label: "Val Recall", value: fmtPct(bestVal?.recall) },
                        ].map(({ label, value }) => (
                            <div key={label} className="bg-white/10 rounded-lg px-4 py-3 text-center min-w-[110px]">
                                <p className="text-sm text-[#9199a1] mb-1">{label}</p>
                                <p className="text-xl font-bold text-white">{value}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Stage selector bar ─────────────────────────────────────────── */}
            <div className="bg-white border-b border-[#e3e6e8] px-6 py-2 flex flex-wrap">
                {STAGES.map(s => (
                    <button
                        key={s.id}
                        onClick={() => setStage(s.id)}
                        className={`px-3.5 py-3 text-base border-b-[3px] -mb-px transition-colors font-medium whitespace-nowrap ${stage === s.id
                            ? "border-[#ffbc88] text-[#232629] font-semibold"
                            : "border-transparent text-[#6a737c] hover:text-[#232629]"
                            }`}
                    >
                        {s.id}. {s.label}
                    </button>
                ))}
            </div>

            {/* ── Stage content ──────────────────────────────────────────────── */}
            <div className="p-6 flex flex-col gap-5">

                {/* Stage 1: Dataset (Species Classifier) ────────────────────── */}
                {stage === 1 && !isGate && (
                    <>
                        {/* Overview text */}
                        <div className="bg-white border border-[#e3e6e8] rounded-lg p-5 shadow-sm">
                            <h2 className="text-base font-bold text-[#232629] mb-2">Dataset Overview</h2>
                            <p className="text-base text-[#6a737c] leading-relaxed">
                                The AvianVision model was trained on a publicly available bird image dataset from HuggingFace.
                                Each species has a dedicated set of validation and test images that were never shown to the
                                model during training, ensuring the performance metrics reflect real-world accuracy.
                            </p>
                            <p className="text-sm text-[#9199a1] mt-3">
                                Source: <span className="font-mono font-semibold">yashikota/birds-525-species-image-classification</span> — HuggingFace
                            </p>
                        </div>

                        {/* Train / val / test split cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { label: "Training", value: "84.6K", sub: "Training images", note: null },
                                { label: "Validation", value: "2,625", sub: "Validation images", note: "5 per species" },
                                { label: "Test", value: "2,625", sub: "Test images", note: "5 per species" },
                            ].map(({ label, value, sub, note }) => (
                                <div key={label} className="bg-white border border-[#e3e6e8] rounded-lg p-5 text-center shadow-sm" style={{ borderTop: "3px solid #babfc4" }}>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-[#9199a1] mb-2">{label}</p>
                                    <p className="text-4xl font-bold text-[#232629]">{value}</p>
                                    <p className="text-base text-[#6a737c] mt-1">{sub}</p>
                                    {note && <p className="text-sm text-[#9199a1] mt-0.5">{note}</p>}
                                </div>
                            ))}
                        </div>

                        {/* Additional dataset facts */}
                        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                            <div className="bg-white border border-[#e3e6e8] rounded-lg p-5 text-center shadow-sm">
                                <p className="text-4xl font-bold text-[#232629]">525</p>
                                <p className="text-base text-[#6a737c] mt-1">Bird species</p>
                            </div>
                            <div className="bg-white border border-[#e3e6e8] rounded-lg p-5 text-center shadow-sm">
                                <p className="text-4xl font-bold text-[#232629]">224²</p>
                                <p className="text-base text-[#6a737c] mt-1">Input image size (pixels)</p>
                            </div>
                        </div>
                    </>
                )}

                {/* Stage 1: Dataset (Bird Gate) ─────────────────────────────── */}
                {stage === 1 && isGate && (
                    <>
                        {/* Overview text */}
                        <div className="bg-white border border-[#e3e6e8] rounded-lg p-5 shadow-sm">
                            <h2 className="text-base font-bold text-[#232629] mb-2">Dataset Overview</h2>
                            <p className="text-base text-[#6a737c] leading-relaxed">
                                The bird gate runs before the species classifier and decides if a photo shows a bird at all.
                                It was trained on bird and not-bird photos from five public datasets. The data was split by source:
                                the test set uses sources the model never saw during training, and the challenge set holds
                                tricky not-bird photos (like planes, bats, and butterflies) that were kept out of training on purpose.
                            </p>
                        </div>

                        {/* Train / val / test / challenge split cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {[
                                { label: "Training", value: "5,036", sub: "Training images", note: null },
                                { label: "Validation", value: "1,678", sub: "Validation images", note: null },
                                { label: "Test", value: "5,920", sub: "Test images", note: "New sources" },
                                { label: "Challenge", value: "438", sub: "Challenge images", note: "Tricky not-birds" },
                            ].map(({ label, value, sub, note }) => (
                                <div key={label} className="bg-white border border-[#e3e6e8] rounded-lg p-5 text-center shadow-sm" style={{ borderTop: "3px solid #babfc4" }}>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-[#9199a1] mb-2">{label}</p>
                                    <p className="text-4xl font-bold text-[#232629]">{value}</p>
                                    <p className="text-base text-[#6a737c] mt-1">{sub}</p>
                                    {note && <p className="text-sm text-[#9199a1] mt-0.5">{note}</p>}
                                </div>
                            ))}
                        </div>

                        {/* Where each split's photos came from */}
                        <div className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden shadow-sm">
                            <div className="px-5 py-3.5 border-b border-[#e3e6e8]">
                                <span className="font-semibold text-base text-[#232629]">Data Sources</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-base border-collapse">
                                    <thead>
                                        <tr className="bg-[#f8f9f9]">
                                            <th className="px-5 py-3 text-left font-semibold text-[#232629] border-b border-[#e3e6e8] w-44">Split</th>
                                            <th className="px-5 py-3 text-left font-semibold text-[#232629] border-b border-[#e3e6e8]">Birds</th>
                                            <th className="px-5 py-3 text-left font-semibold text-[#232629] border-b border-[#e3e6e8]">Not Birds</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { split: "Training & Validation", birds: "CUB-200-2011, Bird vs Drone", notBirds: "Caltech-256 (bird classes removed), drones, and 70% of the airplanes" },
                                            { split: "Test", birds: "Aves del Tolima", notBirds: "Places365" },
                                            { split: "Challenge", birds: "None", notBirds: "7 held-out Caltech-256 classes (fighter jet, helicopter, hot air balloon, blimp, bat, butterfly, house fly) and the other 30% of the airplanes" },
                                        ].map((r, i) => (
                                            <tr key={r.split} className={i % 2 === 0 ? "bg-white" : "bg-[#f8f9f9]"}>
                                                <td className="px-5 py-3 font-semibold text-[#232629] align-top border-b border-[#e3e6e8]">{r.split}</td>
                                                <td className="px-5 py-3 text-[#6a737c] align-top leading-relaxed border-b border-[#e3e6e8]">{r.birds}</td>
                                                <td className="px-5 py-3 text-[#6a737c] align-top leading-relaxed border-b border-[#e3e6e8]">{r.notBirds}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Additional dataset facts */}
                        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                            <div className="bg-white border border-[#e3e6e8] rounded-lg p-5 text-center shadow-sm">
                                <p className="text-4xl font-bold text-[#232629]">2</p>
                                <p className="text-base text-[#6a737c] mt-1">Classes (bird / not bird)</p>
                            </div>
                            <div className="bg-white border border-[#e3e6e8] rounded-lg p-5 text-center shadow-sm">
                                <p className="text-4xl font-bold text-[#232629]">224²</p>
                                <p className="text-base text-[#6a737c] mt-1">Input image size (pixels)</p>
                            </div>
                        </div>
                    </>
                )}

                {/* Stage 2: Architecture ────────────────────────────────────── */}
                {stage === 2 && (
                    <>
                        {/* What is EfficientNetB0 and Transfer Learning */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {[
                                {
                                    title: "What is EfficientNetB0?",
                                    text: "EfficientNetB0 is a compact but powerful image classification model developed by Google. It was originally trained on ImageNet — a dataset of over 14 million images across 1,000 categories — which means it already knows how to recognize shapes, textures, and patterns in photos before any bird training begins.",
                                },
                                {
                                    title: "What is Transfer Learning?",
                                    text: "Transfer learning takes a model already trained on a large dataset and adapts it to a new, more specific task. Rather than relearning basic image recognition from zero, the model builds on what it already knows. This saves time, requires less data, and typically produces better results than training from scratch.",
                                },
                            ].map(({ title, text }) => (
                                <div key={title} className="bg-white border border-[#e3e6e8] rounded-lg p-5 shadow-sm">
                                    <h3 className="font-bold text-base text-[#232629] mb-2">{title}</h3>
                                    <p className="text-base text-[#6a737c] leading-relaxed">{text}</p>
                                </div>
                            ))}
                        </div>

                        {/* Visual layer diagram */}
                        <div className="bg-white border border-[#e3e6e8] rounded-lg p-5 shadow-sm">
                            <h3 className="font-bold text-base text-[#232629] mb-4">Layer Structure</h3>
                            <div className="flex flex-col items-center gap-1 max-w-sm mx-auto">
                                {[
                                    { label: "ImageNet Pretrained Weights", sub: "Starting knowledge — 14M+ images, 1,000 categories", style: "bg-[#f1f2f3] border border-[#e3e6e8] text-[#232629]" },
                                    null,
                                    { label: "Base Layers", sub: "Low-level features — edges, textures, colors", style: "bg-[#232629] text-white" },
                                    null,
                                    { label: "Middle Layers", sub: "Mid-level features — shapes, patterns, structures", style: "bg-[#232629] text-white" },
                                    null,
                                    { label: "End Layers", sub: isGate ? "High-level features — what makes a photo a bird" : "High-level features — bird-specific patterns", style: "bg-[#232629] text-white" },
                                    null,
                                    // The last layer is different for each model: 525 species, or one bird score
                                    { label: "Custom Output Layer", sub: isGate ? "One bird score from 0 to 1 — under the cut-off means not a bird" : "525 bird species — trained specifically for AvianVision", style: "bg-[#fdf2d8] border border-[#e6d8a7] text-[#232629]" },
                                ].map((item, i) =>
                                    item === null ? (
                                        <div key={i} className="text-[#babfc4] text-lg">↓</div>
                                    ) : (
                                        <div key={i} className={`w-full rounded-lg px-5 py-3 text-center ${item.style}`}>
                                            <p className="font-semibold text-sm">{item.label}</p>
                                            <p className="text-sm opacity-70 mt-0.5">{item.sub}</p>
                                        </div>
                                    )
                                )}
                            </div>
                            <p className="text-sm text-center text-[#9199a1] mt-4">
                                Which layers were frozen or unfrozen during training was controlled by the Freeze Base, Freeze Middle, and Freeze End hyperparameters — see Stage 4 for details.
                            </p>
                        </div>
                    </>
                )}

                {/* Stage 3: Data Augmentation ───────────────────────────────── */}
                {stage === 3 && (
                    <>
                        <div className="bg-white border border-[#e3e6e8] rounded-lg p-5 shadow-sm">
                            <h2 className="text-base font-bold text-[#232629] mb-2">Data Augmentation</h2>
                            <p className="text-base text-[#6a737c] leading-relaxed">
                                Data augmentation artificially expands the training dataset by applying random transformations
                                to each image. This teaches the model to be more flexible and reduces the chance of it
                                memorizing the training data instead of learning to truly recognize each species.
                            </p>
                        </div>

                        {/* Techniques used */}
                        {!loading && !error && statsData?.defintions?.aggregations?.length > 0 && (
                            <div className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden shadow-sm">
                                <div className="px-5 py-3.5 border-b border-[#e3e6e8]">
                                    <span className="font-semibold text-base text-[#232629]">Techniques Used</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-base border-collapse">
                                        <thead>
                                            <tr className="bg-[#f8f9f9]">
                                                <th className="px-5 py-3 text-left font-semibold text-[#232629] border-b border-[#e3e6e8] w-44">Technique</th>
                                                <th className="px-5 py-3 text-left font-semibold text-[#232629] border-b border-[#e3e6e8]">What It Does</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {statsData.defintions.aggregations.map((a: any, i: number) => (
                                                <tr key={a.method} className={i % 2 === 0 ? "bg-white" : "bg-[#f8f9f9]"}>
                                                    <td className="px-5 py-3 font-semibold text-[#232629] align-top border-b border-[#e3e6e8]">{a.method}</td>
                                                    <td className="px-5 py-3 text-[#6a737c] align-top leading-relaxed border-b border-[#e3e6e8]">{a.definition}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Augmentation run results table */}
                        {!loading && !error && (() => {
                            const augModels = [...(ml?.aggregation_models ?? [])]
                                .sort((a: any, b: any) => (b?.validation?.accuracy ?? 0) - (a?.validation?.accuracy ?? 0));
                            if (augModels.length === 0) return (
                                <p className="text-base text-[#9199a1] italic">No augmentation runs found.</p>
                            );
                            return (
                                <div className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden shadow-sm">
                                    <div className="px-5 py-3.5 border-b border-[#e3e6e8]">
                                        <span className="font-semibold text-base text-[#232629]">Augmentation Run Results</span>
                                        <span className="ml-2 text-sm text-[#9199a1]">Sorted best-first by validation accuracy.</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-base border-collapse">
                                            <thead>
                                                <tr className="bg-[#f8f9f9]">
                                                    <th className="px-5 py-3 text-left font-semibold text-[#232629] border-b border-[#e3e6e8]">Run Name</th>
                                                    <th className="px-5 py-3 text-center font-semibold text-[#232629] border-b border-[#e3e6e8]">Val Accuracy</th>
                                                    <th className="px-5 py-3 text-center font-semibold text-[#232629] border-b border-[#e3e6e8]">Val F1</th>
                                                    <th className="px-5 py-3 text-center font-semibold text-[#232629] border-b border-[#e3e6e8]">Val Loss</th>
                                                    <th className="px-5 py-3 text-center font-semibold text-[#232629] border-b border-[#e3e6e8]">Train Accuracy</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {/* Top row highlighted in orange to show the best run */}
                                                {augModels.map((m: any, i: number) => (
                                                    <tr key={m.run_name} className={i === 0 ? "bg-[#fdf2d8]" : i % 2 === 1 ? "bg-[#f8f9f9]" : "bg-white"}>
                                                        <td className="px-5 py-3 font-mono text-sm text-[#232629] align-middle border-b border-[#e3e6e8]">
                                                            {m.run_name}
                                                            {i === 0 && (
                                                                <span className="ml-2 inline-block rounded-full bg-[#232629] text-white text-xs px-2 py-0.5">Best</span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3 text-center font-semibold text-[#232629] border-b border-[#e3e6e8]">{fmtPct(m?.validation?.accuracy)}</td>
                                                        <td className="px-5 py-3 text-center text-[#6a737c] border-b border-[#e3e6e8]">{fmtPct(m?.validation?.f1_score)}</td>
                                                        <td className="px-5 py-3 text-center text-[#6a737c] border-b border-[#e3e6e8]">{fmtLoss(m?.validation?.loss)}</td>
                                                        <td className="px-5 py-3 text-center text-[#6a737c] border-b border-[#e3e6e8]">{fmtPct(m?.train?.accuracy)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })()}
                        {loading && <p className="text-base text-[#9199a1]">Loading augmentation data…</p>}
                    </>
                )}

                {/* Stage 4: Hyperparameter Tuning ───────────────────────────── */}
                {stage === 4 && (
                    <>
                        <div className="bg-white border border-[#e3e6e8] rounded-lg p-5 shadow-sm">
                            <h2 className="text-base font-bold text-[#232629] mb-2">Hyperparameter Tuning</h2>
                            <p className="text-base text-[#6a737c] leading-relaxed">
                                Hyperparameters are settings that control how the model trains — they are not learned from the
                                data, they are chosen before training begins. Tuning them means running the model multiple
                                times with different combinations of settings to find the configuration that performs best.
                            </p>
                        </div>

                        {/* Parameters tuned table */}
                        {!loading && !error && statsData?.defintions?.hyperparameters?.length > 0 && (
                            <div className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden shadow-sm">
                                <div className="px-5 py-3.5 border-b border-[#e3e6e8]">
                                    <span className="font-semibold text-base text-[#232629]">Parameters Tuned</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-base border-collapse">
                                        <thead>
                                            <tr className="bg-[#f8f9f9]">
                                                <th className="px-5 py-3 text-left font-semibold text-[#232629] border-b border-[#e3e6e8] w-44">Parameter</th>
                                                <th className="px-5 py-3 text-left font-semibold text-[#232629] border-b border-[#e3e6e8]">What It Controls</th>
                                                <th className="px-5 py-3 text-left font-semibold text-[#232629] border-b border-[#e3e6e8]">Impact</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {statsData.defintions.hyperparameters.map((h: any, i: number) => (
                                                <tr key={h.parameter} className={i % 2 === 0 ? "bg-white" : "bg-[#f8f9f9]"}>
                                                    <td className="px-5 py-3 font-semibold text-[#232629] align-top border-b border-[#e3e6e8]">{h.parameter}</td>
                                                    <td className="px-5 py-3 text-[#6a737c] align-top leading-relaxed border-b border-[#e3e6e8]">{h.definition}</td>
                                                    <td className="px-5 py-3 text-[#6a737c] align-top leading-relaxed border-b border-[#e3e6e8]">{h.impact}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Top tuning runs table */}
                        {!loading && !error && (() => {
                            const htModels = ml?.top_hyperparameter_models ?? [];
                            if (htModels.length === 0) return (
                                <p className="text-base text-[#9199a1] italic">No hyperparameter tuning runs found.</p>
                            );
                            return (
                                <div className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden shadow-sm">
                                    <div className="px-5 py-3.5 border-b border-[#e3e6e8]">
                                        <span className="font-semibold text-base text-[#232629]">Top Tuning Runs</span>
                                        <span className="ml-2 text-sm text-[#9199a1]">The five best-performing runs ranked by validation accuracy.</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-base border-collapse">
                                            <thead>
                                                <tr className="bg-[#f8f9f9]">
                                                    <th className="px-5 py-3 text-center font-semibold text-[#232629] border-b border-[#e3e6e8] w-12">Rank</th>
                                                    <th className="px-5 py-3 text-left font-semibold text-[#232629] border-b border-[#e3e6e8]">Run Name</th>
                                                    <th className="px-5 py-3 text-center font-semibold text-[#232629] border-b border-[#e3e6e8]">Val Accuracy</th>
                                                    <th className="px-5 py-3 text-center font-semibold text-[#232629] border-b border-[#e3e6e8]">Val F1</th>
                                                    <th className="px-5 py-3 text-center font-semibold text-[#232629] border-b border-[#e3e6e8]">Val Loss</th>
                                                    <th className="px-5 py-3 text-center font-semibold text-[#232629] border-b border-[#e3e6e8]">Train Accuracy</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {/* Best run is highlighted in orange */}
                                                {htModels.map((m: any, i: number) => (
                                                    <tr key={m.run_name} className={i === 0 ? "bg-[#fdf2d8]" : i % 2 === 1 ? "bg-[#f8f9f9]" : "bg-white"}>
                                                        <td className="px-5 py-3 text-center font-bold text-[#232629] border-b border-[#e3e6e8]">{i + 1}</td>
                                                        <td className="px-5 py-3 font-mono text-sm text-[#232629] align-middle border-b border-[#e3e6e8]">
                                                            {m.run_name}
                                                            {i === 0 && (
                                                                <span className="ml-2 inline-block rounded-full bg-[#232629] text-white text-xs px-2 py-0.5">Best</span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3 text-center font-semibold text-[#232629] border-b border-[#e3e6e8]">{fmtPct(m?.validation?.accuracy)}</td>
                                                        <td className="px-5 py-3 text-center text-[#6a737c] border-b border-[#e3e6e8]">{fmtPct(m?.validation?.f1_score)}</td>
                                                        <td className="px-5 py-3 text-center text-[#6a737c] border-b border-[#e3e6e8]">{fmtLoss(m?.validation?.loss)}</td>
                                                        <td className="px-5 py-3 text-center text-[#6a737c] border-b border-[#e3e6e8]">{fmtPct(m?.train?.accuracy)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })()}
                        {loading && <p className="text-base text-[#9199a1]">Loading hyperparameter data…</p>}
                    </>
                )}

                {/* Stage 5: Final Evaluation ────────────────────────────────── */}
                {stage === 5 && (
                    <>
                        {/* Model progression — four stages as a visual chain */}
                        {!loading && !error && (() => {
                            const baseAcc = ml?.base_model?.validation?.accuracy;
                            const augModels = ml?.aggregation_models ?? [];
                            const bestAug = augModels.reduce((b: any, m: any) =>
                                (m?.validation?.accuracy ?? 0) > (b?.validation?.accuracy ?? 0) ? m : b, null);
                            const htAcc = ml?.best_hyperparameter_model?.validation?.accuracy;
                            const finalAcc = ml?.best_model?.test?.accuracy;
                            const progStages = [
                                { label: "Base Model", sub: "Val Accuracy", acc: baseAcc ?? null },
                                ...(bestAug ? [{ label: "+ Data Augmentation", sub: "Val Accuracy", acc: bestAug?.validation?.accuracy ?? null }] : []),
                                { label: "+ Hyperparameter Tuning", sub: "Val Accuracy", acc: htAcc ?? null },
                                { label: "Final Model", sub: "Test Accuracy", acc: finalAcc ?? null, final: true },
                            ];
                            return (
                                <div className="bg-white border border-[#e3e6e8] rounded-lg p-5 shadow-sm">
                                    <h2 className="text-base font-bold text-[#232629] mb-4">Model Progression</h2>
                                    <div className="flex flex-wrap items-center gap-3 justify-center">
                                        {progStages.map((s, i) => (
                                            <div key={s.label} className="flex items-center gap-3">
                                                <div className={`rounded-lg px-5 py-4 text-center w-40 border ${(s as any).final
                                                    ? "bg-[#fdf2d8] border-[#e6d8a7]"
                                                    : "bg-[#f8f9f9] border-[#e3e6e8]"
                                                    }`}>
                                                    <p className="text-xs font-semibold uppercase tracking-widest text-[#9199a1] mb-1">Stage {i + 1}</p>
                                                    <p className="text-xs font-bold text-[#232629] leading-snug mb-2">{s.label}</p>
                                                    <p className="text-2xl font-bold text-[#232629]">
                                                        {s.acc != null ? (s.acc * 100).toFixed(1) + "%" : "—"}
                                                    </p>
                                                    <p className="text-xs text-[#9199a1] mt-0.5">{s.sub}</p>
                                                </div>
                                                {i < progStages.length - 1 && (
                                                    <span className="text-xl text-[#babfc4] font-light">→</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* How to read the results (Species Classifier) */}
                        {!loading && !error && !isGate && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white border border-[#e3e6e8] rounded-lg p-5 shadow-sm">
                                    <p className="text-xs font-semibold uppercase tracking-widest text-[#9199a1] mb-2">Test Accuracy</p>
                                    <p className="text-2xl font-bold text-[#232629] mb-3">{fmtPct(bestTest?.accuracy)}</p>
                                    <p className="text-base text-[#6a737c] leading-relaxed">
                                        If you uploaded 100 random bird photos, the model would correctly identify the species in roughly{" "}
                                        <strong>{bestTest?.accuracy != null ? Math.round(bestTest.accuracy * 100) : "—"} of them</strong> — choosing from 525 possible species each time.
                                    </p>
                                </div>
                                <div className="bg-white border border-[#e3e6e8] rounded-lg p-5 shadow-sm">
                                    <p className="text-xs font-semibold uppercase tracking-widest text-[#9199a1] mb-2">Test F1 Score</p>
                                    <p className="text-2xl font-bold text-[#232629] mb-3">{fmtPct(bestTest?.f1_score)}</p>
                                    <p className="text-base text-[#6a737c] leading-relaxed">
                                        F1 score rewards the model for being both accurate in its confident guesses and thorough in finding the right species.
                                        A score above 90% means the model is doing well on both fronts across all 525 classes.
                                    </p>
                                </div>
                                <div className="bg-[#fdf2d8] border border-[#e6d8a7] rounded-lg p-5 shadow-sm">
                                    <p className="text-xs font-semibold uppercase tracking-widest text-[#9199a1] mb-2">Is this good?</p>
                                    <p className="text-2xl font-bold text-[#232629] mb-3">Yes.</p>
                                    <p className="text-base text-[#6a737c] leading-relaxed">
                                        Random guessing across 525 species would give an accuracy of only 0.19%.
                                        The AvianVision model performs far above that baseline and is competitive with published research on fine-grained bird classification.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* How to read the results (Bird Gate) */}
                        {!loading && !error && isGate && (() => {
                            const gTest = best?.test;
                            const challenge = best?.challenge;
                            // Photos blocked = total challenge photos minus the ones the gate let through
                            const blocked = challenge?.total != null && challenge?.let_through != null
                                ? challenge.total - challenge.let_through
                                : null;
                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white border border-[#e3e6e8] rounded-lg p-5 shadow-sm">
                                        <p className="text-xs font-semibold uppercase tracking-widest text-[#9199a1] mb-2">Test Accuracy</p>
                                        <p className="text-2xl font-bold text-[#232629] mb-3">{fmtPct(gTest?.accuracy)}</p>
                                        <p className="text-base text-[#6a737c] leading-relaxed">
                                            If you uploaded 100 random photos, some with birds and some without, the gate would sort roughly{" "}
                                            <strong>{gTest?.accuracy != null ? Math.round(gTest.accuracy * 100) : "—"} of them</strong> into the right group.
                                        </p>
                                    </div>
                                    <div className="bg-white border border-[#e3e6e8] rounded-lg p-5 shadow-sm">
                                        <p className="text-xs font-semibold uppercase tracking-widest text-[#9199a1] mb-2">Test AUC</p>
                                        <p className="text-2xl font-bold text-[#232629] mb-3">{fmtPct(gTest?.auc)}</p>
                                        <p className="text-base text-[#6a737c] leading-relaxed">
                                            AUC measures how well the bird score separates birds from not-birds, no matter where the cut-off is set.
                                            100% would mean every bird scores higher than every not-bird.
                                        </p>
                                    </div>
                                    <div className="bg-white border border-[#e3e6e8] rounded-lg p-5 shadow-sm">
                                        <p className="text-xs font-semibold uppercase tracking-widest text-[#9199a1] mb-2">Bird Recall (Test)</p>
                                        <p className="text-2xl font-bold text-[#232629] mb-3">{fmtPct(gTest?.bird_recall)}</p>
                                        <p className="text-base text-[#6a737c] leading-relaxed">
                                            Out of every 100 real bird photos, about{" "}
                                            <strong>{gTest?.bird_recall != null ? Math.round(gTest.bird_recall * 100) : "—"}</strong> are let through to the species classifier.
                                        </p>
                                    </div>
                                    <div className="bg-white border border-[#e3e6e8] rounded-lg p-5 shadow-sm">
                                        <p className="text-xs font-semibold uppercase tracking-widest text-[#9199a1] mb-2">Not-Bird Recall (Test)</p>
                                        <p className="text-2xl font-bold text-[#232629] mb-3">{fmtPct(gTest?.not_bird_recall)}</p>
                                        <p className="text-base text-[#6a737c] leading-relaxed">
                                            Out of every 100 photos without a bird, about{" "}
                                            <strong>{gTest?.not_bird_recall != null ? Math.round(gTest.not_bird_recall * 100) : "—"}</strong> are stopped before they reach the species classifier.
                                        </p>
                                    </div>
                                    <div className="bg-[#fdf2d8] border border-[#e6d8a7] rounded-lg p-5 shadow-sm md:col-span-2">
                                        <p className="text-xs font-semibold uppercase tracking-widest text-[#9199a1] mb-2">Challenge Set</p>
                                        <p className="text-2xl font-bold text-[#232629] mb-3">
                                            {blocked != null ? `${blocked} of ${challenge.total} blocked` : "—"}
                                        </p>
                                        <p className="text-base text-[#6a737c] leading-relaxed">
                                            The challenge set is made of tricky not-bird photos the gate never saw during training: fighter jets, helicopters,
                                            hot air balloons, blimps, bats, butterflies, house flies, and airplanes. Challenge accuracy: <strong>{fmtPct(challenge?.accuracy)}</strong>.
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Metrics reference table (Species Classifier only for now) */}
                        {!loading && !error && !isGate && statsData?.defintions?.metrics?.length > 0 && (
                            <div className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden shadow-sm">
                                <div className="px-5 py-3.5 border-b border-[#e3e6e8]">
                                    <span className="font-semibold text-base text-[#232629]">Understanding the Metrics</span>
                                    <span className="ml-2 text-sm text-[#9199a1]">Precision, Recall, and F1 are macro-averaged — each of the 525 species is weighted equally.</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-base border-collapse">
                                        <thead>
                                            <tr className="bg-[#f8f9f9]">
                                                <th className="px-5 py-3 text-left font-semibold text-[#232629] border-b border-[#e3e6e8] w-32">Metric</th>
                                                <th className="px-5 py-3 text-left font-semibold text-[#232629] border-b border-[#e3e6e8]">Description</th>
                                                <th className="px-5 py-3 text-left font-semibold text-[#232629] border-b border-[#e3e6e8] w-44">Formula</th>
                                                <th className="px-5 py-3 text-center font-semibold text-[#232629] border-b border-[#e3e6e8] w-24">Better When</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {statsData.defintions.metrics.map((m: any, i: number) => (
                                                <tr key={m.metric} className={i % 2 === 0 ? "bg-white" : "bg-[#f8f9f9]"}>
                                                    <td className="px-5 py-3 font-semibold text-[#232629] align-top border-b border-[#e3e6e8]">{m.metric}</td>
                                                    <td className="px-5 py-3 text-[#6a737c] align-top leading-relaxed border-b border-[#e3e6e8]">{m.definition}</td>
                                                    <td className="px-5 py-3 align-top border-b border-[#e3e6e8]"><FormulaCell m={m} /></td>
                                                    <td className="px-5 py-3 text-center align-top border-b border-[#e3e6e8]">
                                                        <span className={`inline-block rounded-full px-3 py-1.5 text-xs font-semibold min-w-[80px] text-center ${m["Better Direction"]?.toLowerCase().includes("higher")
                                                            ? "bg-[#fdf2d8] text-[#232629]"
                                                            : "bg-[#ffbc88] text-[#232629]"
                                                            }`}>
                                                            {m["Better Direction"] ?? "—"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Try it yourself CTA */}
                        <div className="bg-[#232629] rounded-lg p-8 text-center">
                            <h2 className="text-xl font-bold text-white mb-2">Try It Yourself</h2>
                            <p className="text-base text-[#9199a1] leading-relaxed mb-5 max-w-md mx-auto">
                                {isGate
                                    ? "You have seen the numbers — now put the gate to the test. Upload any photo and see if the gate lets it through to the species classifier."
                                    : "You have seen the numbers — now put the model to the test. Upload a photo of a bird and see which of the 525 species AvianVision thinks it is."}
                            </p>
                            <a
                                href="/predict"
                                className="inline-block rounded-lg bg-[#ffbc88] text-[#232629] font-bold text-base px-6 py-3 hover:bg-[#ff9f5a] transition-colors"
                            >
                                Go to Prediction →
                            </a>
                        </div>

                        {loading && <p className="text-base text-[#9199a1]">Loading evaluation data…</p>}
                    </>
                )}

            </div>
        </main>
    );
}