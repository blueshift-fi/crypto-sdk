

export async function awaitTimeout(delay: number) {
    return new Promise(resolve => setTimeout(resolve, delay));
}
