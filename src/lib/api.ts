import {createServerFn} from "@tanstack/react-start";

export const fetchNordPoolPrices = createServerFn({ method: "GET" })
	.inputValidator((data: { year: string }) => data)
	.handler(async ({ data }) => {
		const { year } = data;
		const start = `${year}-04-01T00:00:00Z`;
		const end = `${Number.parseInt(year) + 1}-03-31T23:59:59Z`;

		try {
			const res = await fetch(
				`https://dashboard.elering.ee/api/nps/price?start=${start}&end=${end}`,
			);

			if (!res.ok) {
				throw new Error(`Failed to fetch from Elering: ${res.statusText}`);
			}

			return await res.json();
		} catch (error) {
			console.error("Error fetching NordPool prices:", error);

			throw error;
		}
	});
