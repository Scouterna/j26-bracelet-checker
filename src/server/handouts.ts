import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { prisma } from "#/db";
import { verifyAndGetUser } from "#/lib/auth";

async function requireHandoutRole() {
	const token = getCookie("j26-auth_access-token");
	if (!token) throw new Error("Unauthorized");
	const user = await verifyAndGetUser(token);
	if (!user) throw new Error("Forbidden");
	if (!user.roles.includes("items:handout") && !user.roles.includes("items:create"))
		throw new Error("Forbidden");
	return user;
}

function dbError(fn: string, err: unknown): never {
	console.error(`[handouts:${fn}]`, err);
	throw new Error("Databasfel. Försök igen senare.");
}

export interface ProductStatus {
	id: string;
	name: string;
	description: string | null;
	handedOut: boolean;
	handedOutAt: Date | null;
}

export const getBraceletStatus = createServerFn({ method: "GET" })
	.validator((input: { braceletId: string }) => input)
	.handler(async ({ data }): Promise<ProductStatus[]> => {
		await requireHandoutRole();

		const products = await prisma.product
			.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } })
			.catch((e) => dbError("getBraceletStatus/products", e));

		const handouts = await prisma.handout
			.findMany({
				where: {
					braceletId: data.braceletId,
					productId: { in: products.map((p) => p.id) },
				},
			})
			.catch((e) => dbError("getBraceletStatus/handouts", e));

		const handoutMap = new Map(handouts.map((h) => [h.productId, h]));

		return products.map((p) => ({
			id: p.id,
			name: p.name,
			description: p.description,
			handedOut: handoutMap.has(p.id),
			handedOutAt: handoutMap.get(p.id)?.handedOutAt ?? null,
		}));
	});

export const recordHandout = createServerFn({ method: "POST" })
	.validator(
		(input: { braceletId: string; productId: string; locationId: string | null }) => input,
	)
	.handler(async ({ data }) => {
		const user = await requireHandoutRole();

		await prisma.handout
			.upsert({
				where: {
					braceletId_productId: {
						braceletId: data.braceletId,
						productId: data.productId,
					},
				},
				create: {
					braceletId: data.braceletId,
					productId: data.productId,
					locationId: data.locationId,
					handedOutBy: user.sub,
				},
				update: {},
			})
			.catch((e) => dbError("recordHandout", e));
	});

export const undoHandout = createServerFn({ method: "POST" })
	.validator((input: { braceletId: string; productId: string }) => input)
	.handler(async ({ data }) => {
		await requireHandoutRole();

		await prisma.handout
			.deleteMany({
				where: {
					braceletId: data.braceletId,
					productId: data.productId,
				},
			})
			.catch((e) => dbError("undoHandout", e));
	});
