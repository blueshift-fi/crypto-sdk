

export async function awaitTimeout(delay: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, delay));
}
