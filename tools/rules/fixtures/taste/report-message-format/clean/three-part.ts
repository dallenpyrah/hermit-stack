export const check = (context: { report: (input: { message: string }) => void }, name: string) => {
  context.report({ message: `Contract imports ${name}. Contracts must run in Workers and browsers. Fix: import only effect.` });
};
