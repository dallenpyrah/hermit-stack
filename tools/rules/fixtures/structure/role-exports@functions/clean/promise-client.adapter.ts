interface PromiseClientOptions {
  readonly url: string;
}

export const createClient = (options: PromiseClientOptions) => ({
  call: async (name: string, payload: unknown): Promise<unknown> => {
    const response = await fetch(`${options.url}/rpc/${name}`, { body: JSON.stringify(payload), method: "POST" });

    return response.json();
  },
  close: async (): Promise<void> => {},
});

export const ping = async (options: PromiseClientOptions): Promise<boolean> => (await fetch(options.url)).ok;
