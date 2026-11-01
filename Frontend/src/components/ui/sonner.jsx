import { Toaster as Sonner } from "sonner";

export function Toaster({ theme }) {
  return (
    <Sonner
      theme={theme}
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        style: { fontFamily: "var(--font-sans)", borderRadius: "14px" },
      }}
    />
  );
}
