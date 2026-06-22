interface NDEFRecord {
	recordType: string;
	mediaType?: string;
	id?: string;
	data?: DataView;
	encoding?: string;
	lang?: string;
}

interface NDEFMessage {
	records: NDEFRecord[];
}

interface NDEFReadingEvent extends Event {
	message: NDEFMessage;
	serialNumber: string;
}

interface NDEFReader extends EventTarget {
	scan(options?: { signal?: AbortSignal }): Promise<void>;
	addEventListener(
		type: "reading",
		listener: (event: NDEFReadingEvent) => void,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: "error",
		listener: (event: Event & { message: string }) => void,
		options?: boolean | AddEventListenerOptions,
	): void;
	removeEventListener(
		type: "reading",
		listener: (event: NDEFReadingEvent) => void,
		options?: boolean | EventListenerOptions,
	): void;
}

declare let NDEFReader: {
	prototype: NDEFReader;
	new (): NDEFReader;
};
