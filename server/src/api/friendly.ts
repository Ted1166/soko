const BALANCE = /Not enough balance for ([^\s]+) \(balance: \d+, cost: \d+\)/i;

export function friendlyError(message: string): string {
    const balance = message.match(BALANCE);
    if (balance) {
        return `Not enough NEAR in ${balance[1]} to complete that.`;
    }
    if (/Not enough allowance for access key/i.test(message)) {
        return "That trader has run out of gas.";
    }
    return message;
}

export function isFundShort(message: string): boolean {
    return BALANCE.test(message);
}
