import { createFileRoute, Outlet } from "@tanstack/react-router";
import { UserContext } from "#/lib/user-context";
import { getUserStatus } from "#/server/auth";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async () => {
		const { user, tokenPresent } = await getUserStatus();
		if (!tokenPresent) throw new Error("not-logged-in");
		if (!user) throw new Error("unauthorized");
		return { user };
	},
	errorComponent: Unauthorized,
	component: AuthenticatedLayout,
});

function Unauthorized({ error }: { error: Error }) {
	const notLoggedIn = error.message === "not-logged-in";
	return (
		<div className="flex flex-col items-center justify-center min-h-svh gap-3 p-4 text-center">
			<p className="text-4xl">🔒</p>
			<h1 className="text-xl font-semibold">
				{notLoggedIn ? "Inte inloggad" : "Inloggningen misslyckades"}
			</h1>
			<p className="text-gray-500 text-sm">
				{notLoggedIn
					? "Logga in via Jamboree26-portalen för att komma åt denna sida."
					: "Vi kunde inte verifiera din inloggning. Försök logga in igen."}
			</p>
		</div>
	);
}

function AuthenticatedLayout() {
	const { user } = Route.useRouteContext();

	return (
		<UserContext.Provider value={user}>
			<Outlet />
		</UserContext.Provider>
	);
}
