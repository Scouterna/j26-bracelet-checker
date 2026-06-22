import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useUser } from "#/lib/user-context";
import {
	createLocation,
	createProduct,
	deleteProduct,
	getLocations,
	getProducts,
	resetProductHandouts,
	toggleLocation,
	toggleProduct,
} from "#/server/admin";

export const Route = createFileRoute("/_authenticated/admin/")({
	loader: async () => {
		const [products, locations] = await Promise.all([
			getProducts(),
			getLocations(),
		]);
		return { products, locations };
	},
	component: AdminPage,
});

type Tab = "products" | "locations";

function AdminPage() {
	const user = useUser();
	const router = useRouter();
	const { products, locations } = Route.useLoaderData();

	const canAdmin = user.roles.includes("items:create");
	const [tab, setTab] = useState<Tab>("products");

	if (!canAdmin) {
		return (
			<div className="flex flex-col items-center justify-center min-h-svh gap-3 p-4 text-center">
				<p className="text-4xl">🚫</p>
				<h1 className="text-xl font-semibold">Tillgång nekad</h1>
				<p className="text-gray-500 text-sm">
					Du saknar behörighet att administrera.
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-svh">
			<header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
				<Link
					to="/"
					className="text-blue-600 text-sm font-medium mr-1"
					aria-label="Tillbaka"
				>
					←
				</Link>
				<h1 className="font-semibold text-base flex-1">Admin</h1>
				<p className="text-xs text-gray-500 truncate max-w-32">{user.name}</p>
			</header>

			<div className="flex border-b border-gray-200 bg-white">
				<TabButton
					active={tab === "products"}
					onClick={() => setTab("products")}
				>
					Produkter
				</TabButton>
				<TabButton
					active={tab === "locations"}
					onClick={() => setTab("locations")}
				>
					Platser
				</TabButton>
			</div>

			<main className="flex-1 p-4">
				{tab === "products" && (
					<ProductsTab
						products={products}
						onRefresh={() => router.invalidate()}
					/>
				)}
				{tab === "locations" && (
					<LocationsTab
						locations={locations}
						onRefresh={() => router.invalidate()}
					/>
				)}
			</main>
		</div>
	);
}

function TabButton({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
				active
					? "border-blue-600 text-blue-600"
					: "border-transparent text-gray-500"
			}`}
		>
			{children}
		</button>
	);
}

type Product = Awaited<ReturnType<typeof getProducts>>[number];
type Location = Awaited<ReturnType<typeof getLocations>>[number];

function ProductsTab({
	products,
	onRefresh,
}: {
	products: Product[];
	onRefresh: () => void;
}) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [toggling, setToggling] = useState<string | null>(null);
	const [deleting, setDeleting] = useState<string | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [resetting, setResetting] = useState<string | null>(null);

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim()) return;
		setSubmitting(true);
		try {
			await createProduct({
				data: { name: name.trim(), description: description.trim() || undefined },
			});
			setName("");
			setDescription("");
			onRefresh();
		} finally {
			setSubmitting(false);
		}
	}

	async function handleToggle(id: string, active: boolean) {
		setToggling(id);
		try {
			await toggleProduct({ data: { id, active } });
			onRefresh();
		} finally {
			setToggling(null);
		}
	}

	async function handleDelete(id: string) {
		setDeleting(id);
		setDeleteError(null);
		try {
			await deleteProduct({ data: { id } });
			onRefresh();
		} catch (err) {
			setDeleteError(err instanceof Error ? err.message : "Kunde inte ta bort produkten.");
		} finally {
			setDeleting(null);
		}
	}

	function handleResetClick(id: string, name: string) {
		const confirmed = window.confirm(
			`⚠️ VARNING — OÅTERKALLELIGT ⚠️\n\nDu håller på att radera ALLA utdelningar för "${name}".\n\nDetta kan INTE ångras. Alla registrerade utdelningar försvinner permanent och personer kan få produkten igen.\n\nÄr du helt säker på att du vill fortsätta?`,
		);
		if (!confirmed) return;

		setResetting(id);
		resetProductHandouts({ data: { id } })
			.then(({ count }) => {
				alert(`${count} utdelning${count === 1 ? "" : "ar"} raderade.`);
				onRefresh();
			})
			.catch((err) => {
				setDeleteError(err instanceof Error ? err.message : "Kunde inte återställa.");
			})
			.finally(() => setResetting(null));
	}

	return (
		<div className="flex flex-col gap-4">
			{deleteError && (
				<div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
					{deleteError}
				</div>
			)}
			<div className="flex flex-col gap-2">
				{products.length === 0 && (
					<p className="text-gray-500 text-sm text-center py-4">
						Inga produkter ännu.
					</p>
				)}
				{products.map((p) => (
					<div
						key={p.id}
						className={`flex items-center gap-2 bg-white border rounded-xl px-4 py-3 ${
							p.active ? "border-gray-200" : "border-gray-100 opacity-60"
						}`}
					>
						<div className="flex-1 min-w-0">
							<p className="font-medium text-sm">{p.name}</p>
							{p.description && (
								<p className="text-xs text-gray-500 truncate">{p.description}</p>
							)}
						</div>
						<button
							type="button"
							disabled={toggling === p.id || deleting === p.id}
							onClick={() => handleToggle(p.id, !p.active)}
							className={`text-xs rounded-lg px-3 py-1.5 font-medium shrink-0 disabled:opacity-40 ${
								p.active
									? "bg-green-100 text-green-700"
									: "bg-gray-100 text-gray-500"
							}`}
						>
							{toggling === p.id ? "…" : p.active ? "Aktiv" : "Inaktiv"}
						</button>
						<button
							type="button"
							disabled={toggling === p.id || deleting === p.id || resetting === p.id}
							onClick={() => handleResetClick(p.id, p.name)}
							className="text-xs rounded-lg px-3 py-1.5 font-medium shrink-0 bg-yellow-50 text-yellow-700 disabled:opacity-40"
						>
							{resetting === p.id ? "…" : "Återställ"}
						</button>
						<button
							type="button"
							disabled={toggling === p.id || deleting === p.id || resetting === p.id}
							onClick={() => handleDelete(p.id)}
							className="text-xs rounded-lg px-3 py-1.5 font-medium shrink-0 bg-red-50 text-red-600 disabled:opacity-40"
						>
							{deleting === p.id ? "…" : "Ta bort"}
						</button>
					</div>
				))}
			</div>

			<form onSubmit={handleCreate} className="flex flex-col gap-2 pt-2 border-t border-gray-200">
				<p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
					Ny produkt
				</p>
				<input
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Namn *"
					className="border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
					required
				/>
				<input
					type="text"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="Beskrivning (valfri)"
					className="border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
				<button
					type="submit"
					disabled={!name.trim() || submitting}
					className="bg-blue-600 text-white rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-40"
				>
					{submitting ? "Sparar…" : "Lägg till produkt"}
				</button>
			</form>
		</div>
	);
}

function LocationsTab({
	locations,
	onRefresh,
}: {
	locations: Location[];
	onRefresh: () => void;
}) {
	const [name, setName] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [toggling, setToggling] = useState<string | null>(null);

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim()) return;
		setSubmitting(true);
		try {
			await createLocation({ data: { name: name.trim() } });
			setName("");
			onRefresh();
		} finally {
			setSubmitting(false);
		}
	}

	async function handleToggle(id: string, active: boolean) {
		setToggling(id);
		try {
			await toggleLocation({ data: { id, active } });
			onRefresh();
		} finally {
			setToggling(null);
		}
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				{locations.length === 0 && (
					<p className="text-gray-500 text-sm text-center py-4">
						Inga platser ännu.
					</p>
				)}
				{locations.map((l) => (
					<div
						key={l.id}
						className={`flex items-center gap-3 bg-white border rounded-xl px-4 py-3 ${
							l.active ? "border-gray-200" : "border-gray-100 opacity-60"
						}`}
					>
						<p className="flex-1 font-medium text-sm">{l.name}</p>
						<button
							type="button"
							disabled={toggling === l.id}
							onClick={() => handleToggle(l.id, !l.active)}
							className={`text-xs rounded-lg px-3 py-1.5 font-medium shrink-0 disabled:opacity-40 ${
								l.active
									? "bg-green-100 text-green-700"
									: "bg-gray-100 text-gray-500"
							}`}
						>
							{toggling === l.id ? "…" : l.active ? "Aktiv" : "Inaktiv"}
						</button>
					</div>
				))}
			</div>

			<form onSubmit={handleCreate} className="flex flex-col gap-2 pt-2 border-t border-gray-200">
				<p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
					Ny plats
				</p>
				<input
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Namn *"
					className="border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
					required
				/>
				<button
					type="submit"
					disabled={!name.trim() || submitting}
					className="bg-blue-600 text-white rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-40"
				>
					{submitting ? "Sparar…" : "Lägg till plats"}
				</button>
			</form>
		</div>
	);
}
