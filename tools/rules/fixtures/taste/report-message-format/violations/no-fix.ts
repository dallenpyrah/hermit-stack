export const check = (context: { report: (input: { message: string }) => void }, name: string) => {
  context.report({ message: `Contract imports ${name}. Contracts run in Workers.` });
};
