import { useRef, useState } from "react";
import type { MonthlyInput } from "../lib/calculator";
import { importEsoZip, mergeEsoIntoInputs } from "../lib/eso-csv";

/**
 * Manages the "import ESO ZIP" flow: the shared file input, in-progress and
 * error state, and merging parsed rows into the monthly inputs. Also tracks
 * whether the manual entry table is open, since a successful import closes it.
 */
export function useEsoImport(
	setMonthlyInputs: React.Dispatch<React.SetStateAction<MonthlyInput[]>>,
) {
	const [isImportingEso, setIsImportingEso] = useState(false);
	const [esoImportError, setEsoImportError] = useState<string | null>(null);
	const [esoImported, setEsoImported] = useState(false);
	const [manualEntry, setManualEntry] = useState(false);
	const esoFileInputRef = useRef<HTMLInputElement>(null);

	const handleEsoImport = async (file: File) => {
		setIsImportingEso(true);
		setEsoImportError(null);
		try {
			const rows = await importEsoZip(file);
			setMonthlyInputs((prev) => mergeEsoIntoInputs(prev, rows));
			setEsoImported(true);
			setManualEntry(false);
		} catch (err) {
			setEsoImportError(err instanceof Error ? err.message : "");
			console.error("ESO import failed", err);
		} finally {
			setIsImportingEso(false);
			if (esoFileInputRef.current) esoFileInputRef.current.value = "";
		}
	};

	return {
		isImportingEso,
		esoImportError,
		esoImported,
		manualEntry,
		setManualEntry,
		esoFileInputRef,
		handleEsoImport,
	};
}
