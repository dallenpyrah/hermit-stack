export const check = (context: { report: (input: { message: string }) => void }) => {
  context.report({ message: "Bad import." });
};
