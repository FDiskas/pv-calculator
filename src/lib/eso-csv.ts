import JSZip from "jszip";
import type { MonthlyInput } from "./calculator";

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

export interface EsoMonthlyRow {
	month: string;
	sentToGrid: number; // VNKGEN — generated/fed to grid
	takenFromGrid: number; // VNKSTO — actual grid transmission
}

function parseCsvLine(line: string): string[] {
	const fields: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (ch === ";" && !inQuotes) {
			fields.push(current);
			current = "";
		} else {
			current += ch;
		}
	}
	fields.push(current);
	return fields;
}

function parseEsoCsv(text: string): EsoMonthlyRow[] {
	const cleaned = text.replace(/^\uFEFF/, "");
	const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
	if (lines.length < 2) return [];

	const header = parseCsvLine(lines[0]).map((h) => h.trim());
	const periodIdx = header.findIndex((h) => /Priskaitymo|period/i.test(h));
	const codeIdx = header.findIndex((h) => /Produkto kodas|code/i.test(h));
	const qtyIdx = header.findIndex((h) => /Kiekis|Quantity/i.test(h));

	if (periodIdx < 0 || codeIdx < 0 || qtyIdx < 0) {
		throw new Error(
			"Unexpected CSV format — missing period, product code, or quantity column.",
		);
	}

	const byMonth = new Map<string, EsoMonthlyRow>();

	for (let i = 1; i < lines.length; i++) {
		const fields = parseCsvLine(lines[i]);
		const period = fields[periodIdx];
		const code = fields[codeIdx];
		const qtyRaw = fields[qtyIdx]?.replace(",", ".");
		if (!period || !code || !qtyRaw) continue;

		const match = period.match(/^(\d{4})-(\d{2})/);
		if (!match) continue;
		const monthIdx = parseInt(match[2], 10) - 1;
		if (monthIdx < 0 || monthIdx > 11) continue;

		const monthName = MONTH_NAMES[monthIdx];
		const qty = parseFloat(qtyRaw);
		if (!Number.isFinite(qty)) continue;

		let row = byMonth.get(monthName);
		if (!row) {
			row = { month: monthName, sentToGrid: 0, takenFromGrid: 0 };
			byMonth.set(monthName, row);
		}

		if (code === "VNKGEN") row.sentToGrid = qty;
		else if (code === "VNKSTO") row.takenFromGrid = qty;
	}

	return Array.from(byMonth.values());
}

async function extractCsvFromZip(file: File): Promise<string> {
	const zip = await JSZip.loadAsync(file);
	const csvEntry = Object.values(zip.files).find(
		(f) => !f.dir && /\.csv$/i.test(f.name),
	);
	if (!csvEntry) {
		throw new Error("No CSV file found inside the ZIP archive.");
	}
	return csvEntry.async("string");
}

export async function importEsoZip(file: File): Promise<EsoMonthlyRow[]> {
	const csvText = /\.zip$/i.test(file.name)
		? await extractCsvFromZip(file)
		: await file.text();
	const rows = parseEsoCsv(csvText);
	if (rows.length === 0) {
		throw new Error("No usable rows parsed from CSV.");
	}
	return rows;
}

export function mergeEsoIntoInputs(
	existing: MonthlyInput[],
	rows: EsoMonthlyRow[],
): MonthlyInput[] {
	const byMonth = new Map(rows.map((r) => [r.month, r]));
	return existing.map((input) => {
		const row = byMonth.get(input.month);
		if (!row) return input;
		return {
			...input,
			sentToGrid: row.sentToGrid,
			takenFromGrid: row.takenFromGrid,
		};
	});
}
