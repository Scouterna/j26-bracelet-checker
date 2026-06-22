import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { prisma } from "#/db";
import { verifyAndGetUser } from "#/lib/auth";

async function requireAdminRole() {
	const token = getCookie("j26-auth_access-token");
	if (!token) throw new Error("Unauthorized");
	const user = await verifyAndGetUser(token);
	if (!user) throw new Error("Forbidden");
	if (!user.roles.includes("items:create")) throw new Error("Forbidden");
	return user;
}

function dbError(fn: string, err: unknown): never {
	console.error(`[admin:${fn}]`, err);
	throw new Error("Databasfel. Försök igen senare.");
}

export const getProducts = createServerFn({ method: "GET" }).handler(async () => {
	await requireAdminRole();
	return prisma.product.findMany({ orderBy: { createdAt: "asc" } }).catch((e) => dbError("getProducts", e));
});

export const createProduct = createServerFn({ method: "POST" })
	.validator((input: { name: string; description?: string }) => input)
	.handler(async ({ data }) => {
		await requireAdminRole();
		return prisma.product
			.create({ data: { name: data.name, description: data.description ?? null } })
			.catch((e) => dbError("createProduct", e));
	});

export const toggleProduct = createServerFn({ method: "POST" })
	.validator((input: { id: string; active: boolean }) => input)
	.handler(async ({ data }) => {
		await requireAdminRole();
		return prisma.product
			.update({ where: { id: data.id }, data: { active: data.active } })
			.catch((e) => dbError("toggleProduct", e));
	});

export const deleteProduct = createServerFn({ method: "POST" })
	.validator((input: { id: string }) => input)
	.handler(async ({ data }) => {
		await requireAdminRole();
		const count = await prisma.handout
			.count({ where: { productId: data.id } })
			.catch((e) => dbError("deleteProduct/count", e));
		if (count > 0)
			throw new Error(`Kan inte tas bort — ${count} utdelning${count === 1 ? "" : "ar"} finns registrerade.`);
		await prisma.product.delete({ where: { id: data.id } }).catch((e) => dbError("deleteProduct", e));
	});

export const resetProductHandouts = createServerFn({ method: "POST" })
	.validator((input: { id: string }) => input)
	.handler(async ({ data }) => {
		await requireAdminRole();
		const result = await prisma.handout
			.deleteMany({ where: { productId: data.id } })
			.catch((e) => dbError("resetProductHandouts", e));
		return { count: result.count };
	});

export const getLocations = createServerFn({ method: "GET" }).handler(async () => {
	await requireAdminRole();
	return prisma.location.findMany({ orderBy: { name: "asc" } }).catch((e) => dbError("getLocations", e));
});

export const createLocation = createServerFn({ method: "POST" })
	.validator((input: { name: string }) => input)
	.handler(async ({ data }) => {
		await requireAdminRole();
		return prisma.location
			.create({ data: { name: data.name } })
			.catch((e) => dbError("createLocation", e));
	});

export const toggleLocation = createServerFn({ method: "POST" })
	.validator((input: { id: string; active: boolean }) => input)
	.handler(async ({ data }) => {
		await requireAdminRole();
		return prisma.location
			.update({ where: { id: data.id }, data: { active: data.active } })
			.catch((e) => dbError("toggleLocation", e));
	});

export const getActiveLocations = createServerFn({ method: "GET" }).handler(async () => {
	const token = getCookie("j26-auth_access-token");
	if (!token) throw new Error("Unauthorized");
	const user = await verifyAndGetUser(token);
	if (!user) throw new Error("Forbidden");
	if (!user.roles.includes("items:handout") && !user.roles.includes("items:create"))
		throw new Error("Forbidden");
	return prisma.location
		.findMany({ where: { active: true }, orderBy: { name: "asc" } })
		.catch((e) => dbError("getActiveLocations", e));
});
