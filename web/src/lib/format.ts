export function coins(value: number | string): string {
    const number = Math.round(Number(value));
    return `${number.toLocaleString("en-US")} coins`;
}

export function plain(value: number | string): string {
    return Math.round(Number(value)).toLocaleString("en-US");
}

export function percent(part: number, whole: number): number {
    if (whole <= 0) {
        return 0;
    }
    return Math.min(100, Math.max(0, Math.round((part / whole) * 100)));
}

export function trend(history: number[]): "up" | "down" | "flat" {
    if (history.length < 2) {
        return "flat";
    }
    const first = history[0];
    const last = history[history.length - 1];
    if (last > first) {
        return "up";
    }
    if (last < first) {
        return "down";
    }
    return "flat";
}

export function sparkPoints(history: number[], width: number, height: number): string {
    if (history.length < 2) {
        return "";
    }
    const min = Math.min(...history);
    const max = Math.max(...history);
    const span = max - min || 1;
    return history
        .map((value, index) => {
            const x = (index / (history.length - 1)) * width;
            const y = height - ((value - min) / span) * (height - 4) - 2;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
}

export function clock(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}
