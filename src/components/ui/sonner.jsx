import { Toaster as Sonner } from "sonner"

/**
 * Hinweis-Fenster, fest im hellen Stil.
 *
 * Vorher hing das an next-themes mit Vorgabe "system" — auf einem Rechner mit
 * dunkler Systemeinstellung kamen die Meldungen schwarz, obwohl die App hell
 * ist. Seit der Dunkelmodus raus ist, gibt es nur noch eine Variante.
 */
const Toaster = ({ ...props }) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}

export { Toaster }
