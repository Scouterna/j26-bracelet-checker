import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useUser } from "#/lib/user-context";
import { getActiveLocations } from "#/server/admin";
import {
	type ProductStatus,
	getBraceletStatus,
	recordHandout,
	undoHandout,
} from "#/server/handouts";

export const Route = createFileRoute("/_authenticated/")({
	loader: () => getActiveLocations(),
	component: ScanPage,
});

function ScanPage() {
	const user = useUser();
	const locations = Route.useLoaderData();

	const canHandout =
		user.roles.includes("items:handout") ||
		user.roles.includes("items:create");
	const canAdmin = user.roles.includes("items:create");

	const [locationId, setLocationId] = useState<string | null>(null);

	const [braceletId, setBraceletId] = useState<string | null>(null);
	const [products, setProducts] = useState<ProductStatus[] | null>(null);
	const [nfcActive, setNfcActive] = useState(false);
	const [nfcError, setNfcError] = useState<string | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [devInput, setDevInput] = useState("");
	const abortRef = useRef<AbortController | null>(null);

	async function loadBracelet(id: string) {
		setActionError(null);
		setBraceletId(id);
		setProducts(null);
		try {
			const status = await getBraceletStatus({ data: { braceletId: id } });
			setProducts(status);
		} catch {
			setActionError("Kunde inte hämta armbandsinfo. Försök igen.");
			setBraceletId(null);
		}
	}

	useEffect(() => {
		return () => abortRef.current?.abort();
	}, []);

	async function startNfc() {
		if (typeof window === "undefined" || !("NDEFReader" in window)) {
			setNfcError("NFC stöds inte i den här webbläsaren.");
			return;
		}

		const controller = new AbortController();
		abortRef.current = controller;

		try {
			const reader = new NDEFReader();
			await reader.scan({ signal: controller.signal });
			setNfcActive(true);
			setNfcError(null);
			reader.addEventListener("reading", (event) => {
				loadBracelet(event.serialNumber);
			});
			reader.addEventListener("error", () => {
				setNfcActive(false);
				setNfcError("NFC-läsning misslyckades.");
			});
		} catch (err) {
			if ((err as { name?: string }).name !== "AbortError") {
				setNfcActive(false);
				const e = err as { name?: string; message?: string };
				setNfcError(`Kunde inte starta NFC-läsning. (${e.name}: ${e.message})`);
			}
		}
	}

	async function handleHandout(productId: string) {
		if (!braceletId) return;
		setBusy(productId);
		setActionError(null);
		try {
			await recordHandout({
				data: {
					braceletId,
					productId,
					locationId,
				},
			});
			setProducts((prev) =>
				prev
					? prev.map((p) =>
							p.id === productId
								? { ...p, handedOut: true, handedOutAt: new Date() }
								: p,
						)
					: prev,
			);
		} catch {
			setActionError("Kunde inte registrera utdelning. Försök igen.");
		} finally {
			setBusy(null);
		}
	}

	async function handleUndo(productId: string) {
		if (!braceletId) return;
		setBusy(productId);
		setActionError(null);
		try {
			await undoHandout({ data: { braceletId, productId } });
			setProducts((prev) =>
				prev
					? prev.map((p) =>
							p.id === productId
								? { ...p, handedOut: false, handedOutAt: null }
								: p,
						)
					: prev,
			);
		} catch {
			setActionError("Kunde inte ångra utdelning. Försök igen.");
		} finally {
			setBusy(null);
		}
	}

	if (!canHandout) {
		return (
			<div className="flex flex-col items-center justify-center min-h-svh gap-3 p-4 text-center">
				<p className="text-4xl">🚫</p>
				<h1 className="text-xl font-semibold">Tillgång nekad</h1>
				<p className="text-gray-500 text-sm">
					Du saknar behörighet att dela ut artiklar.
				</p>
			</div>
		);
	}

	if (!locationId) {
		return (
			<div className="flex flex-col items-center justify-center h-svh gap-6 p-8">
				<div className="text-center">
					<p className="text-4xl mb-3">📍</p>
					<h1 className="text-xl font-semibold">Välj din plats</h1>
					<p className="text-gray-500 text-sm mt-1">
						Välj den plats där du delar ut artiklar.
					</p>
				</div>
				{locations.length === 0 ? (
					<p className="text-sm text-gray-400">
						Inga platser konfigurerade. Gå till Admin för att lägga till.
					</p>
				) : (
					<div className="flex flex-col gap-3 w-full max-w-xs">
						{locations.map((l) => (
							<button
								key={l.id}
								type="button"
								onClick={() => setLocationId(l.id)}
								className="w-full bg-white border-2 border-gray-200 rounded-2xl px-6 py-4 text-base font-semibold text-left active:scale-[0.98] transition-transform hover:border-blue-400"
							>
								{l.name}
							</button>
						))}
					</div>
				)}
				{canAdmin && (
					<Link to="/admin" className="text-xs text-gray-400 underline mt-2">
						Admin
					</Link>
				)}
			</div>
		);
	}

	return (
		<div className="flex flex-col h-svh">
			{/* Header */}
			<header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
				<div className="flex-1 flex items-center gap-2">
					<h1 className="font-semibold text-base">Armbandsscanner</h1>
					{nfcActive ? (
						<span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" title="NFC aktiv" />
					) : (
						<span className="w-2 h-2 rounded-full bg-red-400 shrink-0" title="NFC inaktiv" />
					)}
				</div>
				<div className="flex items-center gap-2">
					{locations.length > 0 && locationId && (
						<select
							value={locationId}
							onChange={(e) => setLocationId(e.target.value)}
							className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							{locations.map((l) => (
								<option key={l.id} value={l.id}>
									{l.name}
								</option>
							))}
						</select>
					)}
					{canAdmin && (
						<Link
							to="/admin"
							className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5"
						>
							Admin
						</Link>
					)}
				</div>
			</header>

			{/* Dev-only bracelet input */}
			{import.meta.env.DEV && (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						const id = devInput.trim();
						if (id) { loadBracelet(id); setDevInput(""); }
					}}
					className="flex gap-2 px-4 py-2 bg-yellow-50 border-b border-yellow-200"
				>
					<input
						type="text"
						value={devInput}
						onChange={(e) => setDevInput(e.target.value)}
						placeholder="[DEV] Armbandsid"
						className="flex-1 text-xs border border-yellow-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 font-mono"
					/>
					<button
						type="submit"
						disabled={!devInput.trim()}
						className="text-xs bg-yellow-400 text-yellow-900 font-semibold rounded-lg px-3 py-1.5 disabled:opacity-40"
					>
						Ladda
					</button>
				</form>
			)}

			{/* Main content */}
			<main className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
				{nfcError && (
					<div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
						{nfcError}
					</div>
				)}
				{actionError && (
					<div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
						{actionError}
					</div>
				)}

				{!braceletId ? (
					<div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
						{nfcActive ? (
							<>
								<span className="text-6xl">📱</span>
								<p className="text-base font-medium">Håll armband mot telefonen</p>
							</>
						) : (
							<>
								<span className="text-6xl">📡</span>
								<p className="text-base font-medium text-center">Starta NFC-läsning för att scanna armband</p>
								<button
									type="button"
									onClick={startNfc}
									className="bg-blue-600 text-white font-semibold rounded-2xl px-6 py-3 text-base active:scale-[0.97] transition-transform"
								>
									Starta NFC
								</button>
							</>
						)}
					</div>
				) : (
					<>
						<div className="flex items-center gap-2">
							<div className="flex-1">
								<p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
									Armband
								</p>
								<p className="font-mono text-sm font-semibold">{braceletId}</p>
							</div>
						</div>

						{products === null ? (
							<div className="flex flex-col gap-3">
								{[1, 2, 3].map((i) => (
									<div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
								))}
							</div>
						) : products.length === 0 ? (
							<p className="text-gray-500 text-center py-8 text-sm">
								Inga aktiva produkter att dela ut.
							</p>
						) : (
							<div className="flex flex-col gap-3">
								{products.map((product) => (
									<ProductCard
										key={product.id}
										product={product}
										isBusy={busy === product.id}
										onHandout={() => handleHandout(product.id)}
										onUndo={() => handleUndo(product.id)}
									/>
								))}
							</div>
						)}
					</>
				)}
			</main>
		</div>
	);
}

function formatHandoutTime(date: Date): string {
	const now = new Date();
	const isToday =
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate();

	const time = date.toLocaleTimeString("sv-SE", { timeStyle: "short" });
	if (isToday) return time;

	const dateStr = date.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
	return `${dateStr} ${time}`;
}

function ProductCard({
	product,
	isBusy,
	onHandout,
	onUndo,
}: {
	product: ProductStatus;
	isBusy: boolean;
	onHandout: () => void;
	onUndo: () => void;
}) {
	if (product.handedOut) {
		return (
			<div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-4 flex items-center gap-3">
				<span className="text-2xl shrink-0">✅</span>
				<div className="flex-1 min-w-0">
					<p className="font-semibold text-green-900">{product.name}</p>
					{product.description && (
						<p className="text-xs text-green-700 truncate">{product.description}</p>
					)}
					{product.handedOutAt && (
						<p className="text-xs text-green-600 mt-0.5">
							{formatHandoutTime(new Date(product.handedOutAt))}
						</p>
					)}
				</div>
				<button
					type="button"
					onClick={onUndo}
					disabled={isBusy}
					className="text-xs text-green-700 border border-green-300 rounded-lg px-2.5 py-1.5 shrink-0 disabled:opacity-40 active:scale-95"
				>
					{isBusy ? "…" : "Ångra"}
				</button>
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={onHandout}
			disabled={isBusy}
			className="bg-white border border-gray-200 rounded-2xl px-4 py-4 flex items-center gap-3 w-full text-left active:scale-[0.98] transition-transform disabled:opacity-50"
		>
			<span className="text-2xl shrink-0">📦</span>
			<div className="flex-1 min-w-0">
				<p className="font-semibold">{product.name}</p>
				{product.description && (
					<p className="text-xs text-gray-500 truncate">{product.description}</p>
				)}
			</div>
			<span className="text-sm font-semibold text-blue-600 shrink-0">
				{isBusy ? "…" : "Ge ut"}
			</span>
		</button>
	);
}
